import type { StandardSchemaV1 } from "@standard-schema/spec"
/**
 * Draft Auth client for OAuth 2.0 authentication.
 *
 * ## Quick Start
 *
 * First, create a client.
 *
 * ```ts title="client.ts"
 * import { createClient } from "@draftauth/core/client"
 *
 * const client = createClient({
 *   clientID: "my-client",
 *   issuer: "https://auth.myserver.com"
 * })
 * ```
 *
 * Start the OAuth flow by calling `authorize`.
 *
 * ```ts
 * const result = await client.authorize(
 *   "https://myapp.com/callback",
 *   "code"
 * )
 * if (result.success) {
 *   window.location.href = result.data.url
 * }
 * ```
 *
 * When the user completes the flow, exchange the code for tokens.
 *
 * ```ts
 * const result = await client.exchange(code, redirectUri)
 * if (result.success) {
 *   const { access, refresh } = result.data
 *   // Store tokens securely
 * }
 * ```
 *
 * Verify tokens to get user information.
 *
 * ```ts
 * const result = await client.verify(subjects, accessToken)
 * if (result.success) {
 *   // Access user properties: result.data.subject.properties
 * }
 * ```
 *
 * @packageDocumentation
 */
import { createLocalJWKSet, errors, type JSONWebKeySet, jwtVerify } from "jose"
import {
	InvalidAccessTokenError,
	InvalidAuthorizationCodeError,
	InvalidRefreshTokenError,
	InvalidSubjectError
} from "./error"
import { generatePKCE } from "./pkce"
import type { SubjectSchema } from "./subject"

/**
 * Result type for operations that can succeed or fail.
 *
 * @template T - The success data type
 * @template E - The error type
 *
 * @example
 * ```ts
 * const result = await client.exchange(code, redirectUri)
 * if (result.success) {
 *   // Access token available: result.data.access
 * } else {
 *   // Handle error: result.error.message
 * }
 * ```
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

interface TokenResponse {
	access_token: string
	refresh_token: string
	expires_in: number
}

interface FetchResponse {
	ok: boolean
	text(): Promise<string>
	json(): Promise<unknown>
}

type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponse>

/**
 * Authorization server metadata from well-known endpoints.
 */
export interface WellKnown {
	/**
	 * URI to the JWKS endpoint for token verification.
	 */
	jwks_uri: string
	/**
	 * URI to the token endpoint for authorization code exchange.
	 */
	token_endpoint: string
	/**
	 * URI to the authorization endpoint for starting flows.
	 */
	authorization_endpoint: string
}

/**
 * Tokens returned by the authorization server.
 */
export interface Tokens {
	/**
	 * Access token for making authenticated API requests.
	 */
	access: string
	/**
	 * Refresh token for obtaining new access tokens.
	 */
	refresh: string
	/**
	 * Number of seconds until the access token expires.
	 */
	expiresIn: number
}

/**
 * Challenge data for PKCE flows.
 */
export type Challenge = {
	/**
	 * State parameter for CSRF protection.
	 */
	state: string
	/**
	 * PKCE code verifier for token exchange.
	 */
	verifier?: string
}

/**
 * Client configuration options.
 */
export interface ClientInput {
	/**
	 * Client ID that identifies your application.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "my-web-app"
	 * }
	 * ```
	 */
	clientID: string
	/**
	 * Base URL of your Draft Auth server.
	 *
	 * @example
	 * ```ts
	 * {
	 *   issuer: "https://auth.myserver.com"
	 * }
	 * ```
	 */
	issuer: string
	/**
	 * Optionally, override the internally used fetch function.
	 *
	 * @example
	 * ```ts
	 * {
	 *   fetch: customFetch
	 * }
	 * ```
	 */
	fetch?: FetchLike
}

/**
 * Options for starting an authorization flow.
 */
export interface AuthorizeOptions {
	/**
	 * Enable PKCE flow for enhanced security.
	 *
	 * Recommended for single-page applications and mobile apps.
	 *
	 * @default false
	 * @example
	 * ```ts
	 * {
	 *   pkce: true
	 * }
	 * ```
	 */
	pkce?: boolean
	/**
	 * Specific authentication provider to use.
	 *
	 * If not specified, users see a provider selection screen
	 * or are redirected to the single configured provider.
	 *
	 * @example
	 * ```ts
	 * {
	 *   provider: "google"
	 * }
	 * ```
	 */
	provider?: string
}

/**
 * Result of starting an authorization flow.
 */
export interface AuthorizeResult {
	/**
	 * Challenge data needed for PKCE flows.
	 *
	 * Store this securely and use when exchanging the code.
	 *
	 * @example
	 * ```ts
	 * sessionStorage.setItem("challenge", JSON.stringify(challenge))
	 * ```
	 */
	challenge: Challenge
	/**
	 * Authorization URL to redirect the user to.
	 *
	 * @example
	 * ```ts
	 * window.location.href = url
	 * ```
	 */
	url: string
}

/**
 * Options for token refresh operations.
 */
export interface RefreshOptions {
	/**
	 * Current access token to check before refreshing.
	 *
	 * Helps avoid unnecessary refresh requests.
	 *
	 * @example
	 * ```ts
	 * {
	 *   access: currentAccessToken
	 * }
	 * ```
	 */
	access?: string
}

/**
 * Options for token verification.
 */
export interface VerifyOptions {
	/**
	 * Refresh token for automatic refresh if access token is expired.
	 *
	 * If passed in, this will automatically refresh the access token if it has expired.
	 *
	 * @example
	 * ```ts
	 * {
	 *   refresh: refreshToken
	 * }
	 * ```
	 */
	refresh?: string
	/**
	 * Expected issuer for validation.
	 * @internal
	 */
	issuer?: string
	/**
	 * Expected audience for validation.
	 * @internal
	 */
	audience?: string
	/**
	 * Custom fetch for HTTP requests.
	 *
	 * Optionally, override the internally used fetch function.
	 */
	fetch?: FetchLike
}

/**
 * Result of successful token verification.
 */
export interface VerifyResult<T extends SubjectSchema> {
	/**
	 * New tokens if access token was refreshed during verification.
	 */
	tokens?: Tokens
	/**
	 * Audience (client ID) the token was issued for.
	 * @internal
	 */
	aud: string
	/**
	 * Decoded subject information from the access token.
	 *
	 * Contains user data that was encoded when the token was issued.
	 */
	subject: {
		[K in keyof T]: {
			type: K
			properties: StandardSchemaV1.InferOutput<T[K]>
		}
	}[keyof T]
}

/**
 * Options for UserInfo requests.
 */

/**
 * Draft Auth client with OAuth 2.0 operations.
 */
export interface Client {
	/**
	 * Start an OAuth authorization flow.
	 *
	 * @param redirectURI - Where users will be sent after authorization
	 * @param response - Response type ("code" or "token")
	 * @param opts - Additional authorization options
	 * @returns Authorization URL and challenge data
	 *
	 * @example Basic flow
	 * ```ts
	 * const result = await client.authorize(
	 *   "https://myapp.com/callback",
	 *   "code"
	 * )
	 * if (result.success) {
	 *   window.location.href = result.data.url
	 * }
	 * ```
	 *
	 * @example PKCE flow
	 * ```ts
	 * const result = await client.authorize(
	 *   "https://spa.example.com/callback",
	 *   "code",
	 *   { pkce: true, scopes: ["read", "write"] }
	 * )
	 * if (result.success) {
	 *   sessionStorage.setItem("challenge", JSON.stringify(result.data.challenge))
	 *   window.location.href = result.data.url
	 * }
	 * ```
	 */
	authorize(
		redirectURI: string,
		response: "code" | "token",
		opts?: AuthorizeOptions
	): Promise<Result<AuthorizeResult>>

	/**
	 * Exchange authorization code for tokens.
	 *
	 * @param code - Authorization code from the callback
	 * @param redirectURI - Same redirect URI used in authorization
	 * @param verifier - PKCE code verifier (required for PKCE flows)
	 * @returns Access tokens and metadata
	 *
	 * @example Basic exchange
	 * ```ts
	 * const urlParams = new URLSearchParams(window.location.search)
	 * const code = urlParams.get('code')
	 *
	 * if (code) {
	 *   const result = await client.exchange(code, "https://myapp.com/callback")
	 *   if (result.success) {
	 *     const { access, refresh } = result.data
	 *     // Store tokens securely
	 *   }
	 * }
	 * ```
	 *
	 * @example PKCE exchange
	 * ```ts
	 * const challenge = JSON.parse(sessionStorage.getItem("challenge") || "{}")
	 * const code = new URLSearchParams(window.location.search).get('code')
	 *
	 * if (code && challenge.verifier) {
	 *   const result = await client.exchange(
	 *     code,
	 *     "https://spa.example.com/callback",
	 *     challenge.verifier
	 *   )
	 *   if (result.success) {
	 *     sessionStorage.removeItem("challenge")
	 *     // Handle tokens
	 *   }
	 * }
	 * ```
	 */
	exchange(
		code: string,
		redirectURI: string,
		verifier?: string
	): Promise<Result<Tokens, InvalidAuthorizationCodeError>>

	/**
	 * Refresh an access token using a refresh token.
	 *
	 * @param refresh - Refresh token to use
	 * @param opts - Additional refresh options
	 * @returns New tokens if refresh was needed
	 *
	 * @example Basic refresh
	 * ```ts
	 * const result = await client.refresh(storedRefreshToken)
	 *
	 * if (result.success && result.data.tokens) {
	 *   const { access, refresh: newRefresh } = result.data.tokens
	 *   updateStoredTokens(access, newRefresh)
	 * } else if (result.success) {
	 *   // Token still valid
	 * } else {
	 *   redirectToLogin()
	 * }
	 * ```
	 */
	refresh(
		refresh: string,
		opts?: RefreshOptions
	): Promise<Result<{ tokens?: Tokens }, InvalidRefreshTokenError | InvalidAccessTokenError>>

	/**
	 * Verify and decode an access token.
	 *
	 * @param subjects - Subject schema used when creating the issuer
	 * @param token - Access token to verify
	 * @param options - Additional verification options
	 * @returns Decoded token data and user information
	 *
	 * @example Basic verification
	 * ```ts
	 * const result = await client.verify(subjects, accessToken)
	 *
	 * if (result.success) {
	 *   const { subject, scopes } = result.data
	 *   // Access user ID: subject.properties.userID
	 *   // Access scopes: scopes?.join(', ')
	 * }
	 * ```
	 *
	 * @example With automatic refresh
	 * ```ts
	 * const result = await client.verify(subjects, accessToken, {
	 *   refresh: refreshToken
	 * })
	 *
	 * if (result.success) {
	 *   if (result.data.tokens) {
	 *     // Tokens were refreshed
	 *     updateStoredTokens(result.data.tokens.access, result.data.tokens.refresh)
	 *   }
	 *   // Use verified subject data
	 *   const user = result.data.subject.properties
	 * }
	 * ```
	 */
	verify<T extends SubjectSchema>(
		subjects: T,
		token: string,
		options?: VerifyOptions
	): Promise<
		Result<
			VerifyResult<T>,
			InvalidRefreshTokenError | InvalidAccessTokenError | InvalidSubjectError
		>
	>
}

/**
 * Create a Draft Auth client.
 *
 * @param input - Client configuration
 * @returns Configured client instance
 *
 * @example Basic setup
 * ```ts
 * const client = createClient({
 *   clientID: "my-web-app",
 *   issuer: "https://auth.mycompany.com"
 * })
 * ```
 */
export const createClient = (input: ClientInput): Client => {
	const jwksCache = new Map<string, ReturnType<typeof createLocalJWKSet>>()
	const issuerCache = new Map<string, WellKnown>()
	const issuer = input.issuer
	if (!issuer) {
		throw new Error("No issuer configured")
	}
	const f = input.fetch ?? (fetch as FetchLike)

	const getIssuer = async (): Promise<WellKnown> => {
		const cached = issuerCache.get(issuer)
		if (cached) return cached

		const wellKnown = (await f(`${issuer}/.well-known/oauth-authorization-server`).then(
			(r: FetchResponse) => r.json()
		)) as WellKnown
		issuerCache.set(issuer, wellKnown)
		return wellKnown
	}

	const getJWKS = async () => {
		const wk = await getIssuer()
		const cached = jwksCache.get(issuer)
		if (cached) return cached
		const keyset = (await f(wk.jwks_uri).then((r: FetchResponse) => r.json())) as JSONWebKeySet
		const result = createLocalJWKSet(keyset)
		jwksCache.set(issuer, result)
		return result
	}

	const client: Client = {
		async authorize(redirectURI, response, opts): Promise<Result<AuthorizeResult>> {
			try {
				const wk = await getIssuer()
				const authUrl = new URL(wk.authorization_endpoint)
				const challenge: Challenge = {
					state: crypto.randomUUID()
				}

				authUrl.searchParams.set("client_id", input.clientID)
				authUrl.searchParams.set("redirect_uri", redirectURI)
				authUrl.searchParams.set("response_type", response)
				authUrl.searchParams.set("state", challenge.state)

				if (opts?.provider) {
					authUrl.searchParams.set("provider", opts.provider)
				}

				if (opts?.pkce && response === "code") {
					const pkce = await generatePKCE()
					authUrl.searchParams.set("code_challenge_method", "S256")
					authUrl.searchParams.set("code_challenge", pkce.challenge)
					challenge.verifier = pkce.verifier
				}

				return {
					success: true,
					data: {
						challenge,
						url: authUrl.toString()
					}
				}
			} catch (error) {
				return { success: false, error: error as Error }
			}
		},

		async exchange(code: string, redirectURI: string, verifier?: string) {
			try {
				const wk = await getIssuer()
				const response = await f(wk.token_endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded"
					},
					body: new URLSearchParams({
						code,
						redirect_uri: redirectURI,
						grant_type: "authorization_code",
						client_id: input.clientID,
						...(verifier ? { code_verifier: verifier } : {})
					}).toString()
				})

				if (!response.ok) {
					return {
						success: false,
						error: new InvalidAuthorizationCodeError()
					}
				}

				const responseText = await response.text()
				let json: unknown
				try {
					json = JSON.parse(responseText)
				} catch {
					return {
						success: false,
						error: new InvalidAuthorizationCodeError()
					}
				}

				const tokenResponse = json as TokenResponse
				return {
					success: true,
					data: {
						access: tokenResponse.access_token,
						refresh: tokenResponse.refresh_token,
						expiresIn: tokenResponse.expires_in
					}
				}
			} catch {
				return {
					success: false,
					error: new InvalidAuthorizationCodeError()
				}
			}
		},

		async refresh(refresh, opts) {
			try {
				if (opts?.access) {
					try {
						const jwks = await getJWKS()
						await jwtVerify(opts.access, jwks, { issuer })
						return { success: true, data: {} }
					} catch {}
				}

				const wk = await getIssuer()
				const response = await f(wk.token_endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded"
					},
					body: new URLSearchParams({
						refresh_token: refresh,
						grant_type: "refresh_token"
					}).toString()
				})

				if (!response.ok) {
					return {
						success: false,
						error: new InvalidRefreshTokenError()
					}
				}

				const tokenResponse = (await response.json()) as TokenResponse
				return {
					success: true,
					data: {
						tokens: {
							access: tokenResponse.access_token,
							refresh: tokenResponse.refresh_token,
							expiresIn: tokenResponse.expires_in
						}
					}
				}
			} catch {
				return {
					success: false,
					error: new InvalidRefreshTokenError()
				}
			}
		},

		async verify<T extends SubjectSchema>(
			subjects: T,
			token: string,
			options?: VerifyOptions
		) {
			try {
				const jwks = await getJWKS()
				const jwtResult = await jwtVerify<{
					mode: "access"
					type: keyof T
					properties: StandardSchemaV1.InferInput<T[keyof T]>
				}>(token, jwks, { issuer })

				const validated = await subjects[jwtResult.payload.type]?.["~standard"].validate(
					jwtResult.payload.properties
				)

				if (!validated?.issues && jwtResult.payload.mode === "access") {
					return {
						success: true,
						data: {
							aud: jwtResult.payload.aud as string,
							subject: {
								type: jwtResult.payload.type,
								properties: validated?.value
							}
						}
					}
				}

				return {
					success: false,
					error: new InvalidSubjectError()
				}
			} catch (e) {
				if (e instanceof errors.JWTExpired && options?.refresh) {
					const refreshed = await client.refresh(options.refresh)
					if (!refreshed.success) return refreshed

					if (!refreshed.data.tokens) {
						return {
							success: false,
							error: new InvalidAccessTokenError()
						}
					}

					const verified = await client.verify(subjects, refreshed.data.tokens.access, {
						refresh: refreshed.data.tokens.refresh,
						issuer: options?.issuer,
						audience: options?.audience,
						fetch: options?.fetch
					})

					if (!verified.success) return verified

					return {
						success: true,
						data: {
							...verified.data,
							tokens: refreshed.data.tokens
						}
					}
				}
				return {
					success: false,
					error: new InvalidAccessTokenError()
				}
			}
		}
	}

	return client
}
