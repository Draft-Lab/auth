/**
 * Core issuer implementation using Hono.
 */

import type { Context } from "hono"
import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { cors } from "hono/cors"
import { CompactEncrypt, compactDecrypt, SignJWT } from "jose"
import { type AllowCheckInput, defaultAllowCheck } from "./allow"
import {
	MissingParameterError,
	OauthError,
	UnauthorizedClientError,
	UnknownStateError
} from "./error"
import { encryptionKeys, signingKeys } from "./keys"
import { validatePKCE } from "./pkce"
import type { Provider, ProviderOptions } from "./provider/provider"
import { generateSecureToken } from "./random"
import { Storage, type StorageAdapter } from "./storage/storage"
import type { SubjectPayload, SubjectSchema } from "./subject"
import { setTheme, type Theme } from "./themes/theme"
import type {
	AuthorizationState,
	CodeStoragePayload,
	RefreshTokenStoragePayload,
	TokenGenerationResult
} from "./types"
import { Select } from "./ui/select"
import { getRelativeUrl, lazy, type Prettify } from "./util"

/**
 * Performs an operation with guaranteed minimum execution time.
 * Adds random jitter to prevent timing-based attacks even if operation completes quickly.
 *
 * Used for validating sensitive data where timing differences could leak information
 * (e.g., authorization codes, refresh tokens).
 *
 * @param fn - Async function to execute
 * @param minTimeMs - Minimum execution time in milliseconds (default: 100ms)
 * @returns Result of the function, guaranteed to take at least minTimeMs
 */
const normalizeTimingAsync = async <T>(
	fn: () => Promise<T>,
	minTimeMs: number = 100
): Promise<T> => {
	const startTime = performance.now()

	const result = await fn()

	const elapsed = performance.now() - startTime
	const remainingTime = Math.max(0, minTimeMs - elapsed)

	if (remainingTime > 0) {
		// Add small random jitter (0-20ms) to prevent precise timing measurement
		const jitterBuffer = new Uint32Array(1)
		crypto.getRandomValues(jitterBuffer)
		const jitter = ((jitterBuffer[0] ?? 0) / 0xffffffff) * 20

		const totalDelay = remainingTime + jitter
		await new Promise((resolve) => setTimeout(resolve, totalDelay))
	}

	return result
}

/**
 * Sets the subject payload in the JWT token and returns the response.
 */
export interface OnSuccessResponder<T extends { type: string; properties: unknown }> {
	subject<Type extends T["type"]>(
		type: Type,
		properties: Extract<T, { type: Type }>["properties"],
		opts?: {
			ttl?: {
				access?: number
				refresh?: number
			}
			subject?: string
		}
	): Promise<Response>
}

/**
 * Main issuer input configuration interface.
 */
interface IssuerInput<
	Providers extends Record<string, Provider<unknown>>,
	Subjects extends SubjectSchema,
	Result = {
		[Key in keyof Providers]: Prettify<
			{
				provider: Key
			} & (Providers[Key] extends Provider<infer T> ? T : Record<string, unknown>)
		>
	}[keyof Providers]
> {
	/** The storage adapter for persisting tokens and sessions */
	storage: StorageAdapter
	/** Auth providers configuration */
	providers: Providers
	/** Subject schemas for token validation */
	subjects: Subjects
	/** Base path for embedded scenarios (e.g., "/auth" or "/api/auth") */
	basePath?: string
	/** Success callback for completed authentication */
	success(
		response: OnSuccessResponder<SubjectPayload<Subjects>>,
		input: Result,
		req: Request,
		clientID: string
	): Promise<Response>
	/** Theme configuration for UI */
	theme?: Theme
	/** TTL configuration for tokens and sessions */
	ttl?: {
		access?: number
		refresh?: number
		reuse?: number
		retention?: number
	}
	/** Provider selection UI function */
	select?(providers: Record<string, string>, req: Request): Promise<Response>
	/** Optional start callback */
	start?(req: Request): Promise<void>
	/** Error handling callback */
	error?(error: UnknownStateError, req: Request): Promise<Response>
	/** Client authorization check function */
	allow?(input: AllowCheckInput, req: Request): Promise<boolean>
	/**
	 * Refresh callback for updating user claims.
	 *
	 * @example
	 * ```typescript
	 * refresh: async (payload, req) => {
	 *   const user = await getUserBySubject(payload.subject)
	 *   if (!user || !user.active) {
	 *     return undefined
	 *   }
	 *
	 *   return {
	 *     type: payload.type,
	 *     properties: {
	 *       userID: user.id,
	 *       role: user.role,
	 *       permissions: user.permissions,
	 *       lastLogin: new Date().toISOString()
	 *     }
	 *   }
	 * }
	 * ```
	 */
	refresh?(
		payload: {
			type: SubjectPayload<Subjects>["type"]
			properties: SubjectPayload<Subjects>["properties"]
			subject: string
			clientID: string
			scopes?: string[]
		},
		req: Request
	): Promise<
		| {
				type: SubjectPayload<Subjects>["type"]
				properties: SubjectPayload<Subjects>["properties"]
				subject?: string
				scopes?: string[]
		  }
		| undefined
	>
}

/**
 * Determines if the incoming request is using HTTPS protocol.
 * Checks multiple proxy headers to handle load balancers and reverse proxies.
 */
const isHttpsRequest = (c: Context): boolean => {
	return (
		c.req.header("x-forwarded-proto") === "https" ||
		c.req.header("x-forwarded-ssl") === "on" ||
		c.req.url.startsWith("https://")
	)
}

/**
 * Create a Draft Auth server, a Hono app that handles OAuth 2.0 flows.
 */
export const issuer = <
	Providers extends Record<string, Provider<unknown>>,
	Subjects extends SubjectSchema,
	Result = {
		[key in keyof Providers]: {
			provider: key
		} & (Providers[key] extends Provider<infer T> ? T : Record<string, unknown>)
	}[keyof Providers]
>(
	input: IssuerInput<Providers, Subjects, Result>
): Hono<{ Variables: { authorization: AuthorizationState; provider: string } }> => {
	// Configuration setup
	const error =
		input.error ??
		((err: UnknownStateError) => {
			return new Response(err.message, {
				status: 400,
				headers: { "Content-Type": "text/plain" }
			})
		})

	const ttlAccess = input.ttl?.access ?? 60 * 60 * 24 * 30
	const ttlRefresh = input.ttl?.refresh ?? 60 * 60 * 24 * 365
	const ttlRefreshReuse = input.ttl?.reuse ?? 60
	const ttlRefreshRetention = input.ttl?.retention ?? 0

	if (input.theme) {
		setTheme(input.theme)
	}

	const storage = input.storage
	const select = lazy(() => input.select ?? Select())
	const allSigning = lazy(() => signingKeys(storage))
	const allEncryption = lazy(() => encryptionKeys(storage))
	const allow = lazy(() => input.allow ?? defaultAllowCheck)
	const signingKey = lazy(() => allSigning().then((all) => all[0]))
	const encryptionKey = lazy(() => allEncryption().then((all) => all[0]))

	// Cookie path for basePath support
	const cookiePath = input.basePath || "/"

	/**
	 * Resolves issuer URL from context.
	 * Returns the base URL for the OAuth issuer, considering basePath configuration.
	 */
	const issuerUrl = (c: Context): string => {
		const baseUrl = new URL(getRelativeUrl(c, "/"))

		if (input.basePath) {
			// Ensure basePath starts with / and doesn't end with /
			const normalizedBasePath = input.basePath.startsWith("/")
				? input.basePath
				: `/${input.basePath}`
			baseUrl.pathname = normalizedBasePath.replace(/\/$/, "")
			return baseUrl.href
		}

		return baseUrl.origin
	}

	/**
	 * Encrypts value for secure cookie storage.
	 */
	const encrypt = async (value: unknown): Promise<string> => {
		const key = await encryptionKey()
		if (!key) {
			throw new Error("Encryption key not available")
		}
		return await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(value)))
			.setProtectedHeader({ alg: "RSA-OAEP-512", enc: "A256GCM" })
			.encrypt(key.public)
	}

	/**
	 * Decrypts value from secure cookie storage.
	 */
	const decrypt = async (value: string): Promise<unknown> => {
		const key = await encryptionKey()
		if (!key) {
			throw new Error("Encryption key not available")
		}
		return JSON.parse(
			new TextDecoder().decode(
				await compactDecrypt(value, key.private).then((result) => result.plaintext)
			)
		)
	}

	/**
	 * Resolves unique subject identifier from type and properties.
	 */
	const resolveSubject = async (type: string, properties: unknown): Promise<string> => {
		const jsonString = JSON.stringify(properties)
		const encoder = new TextEncoder()
		const data = encoder.encode(jsonString)
		const hashBuffer = await crypto.subtle.digest("SHA-256", data)
		const hashArray = Array.from(new Uint8Array(hashBuffer))
		const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
		return `${type}:${hashHex.slice(0, 16)}`
	}

	/**
	 * Generates access and refresh tokens for OAuth 2.0.
	 */
	const generateTokens = async (
		c: Context,
		value: {
			type: string
			properties: unknown
			subject: string
			clientID: string
			ttl: { access: number; refresh: number }
			timeUsed?: number
			nextToken?: string
		},
		opts?: { generateRefreshToken?: boolean }
	): Promise<TokenGenerationResult> => {
		const refreshToken = value.nextToken ?? generateSecureToken()

		if (opts?.generateRefreshToken ?? true) {
			const refreshPayload = {
				type: value.type,
				properties: value.properties,
				clientID: value.clientID,
				subject: value.subject,
				ttl: value.ttl,
				nextToken: generateSecureToken(),
				timeUsed: value.timeUsed
			}

			const refreshKey = ["oauth:refresh", value.subject, refreshToken]
			await Storage.set(storage, refreshKey, refreshPayload, value.ttl.refresh)
		}

		const signingKeyData = await signingKey()
		if (!signingKeyData) {
			throw new Error("Signing key not available")
		}

		const now = Math.floor(Date.now() / 1000)

		if (!value.clientID.trim()) {
			throw new Error("Invalid audience: client ID cannot be empty")
		}

		const accessPayload = {
			type: value.type,
			properties: value.properties,
			sub: value.subject,
			aud: value.clientID,
			iss: issuerUrl(c),
			exp: now + value.ttl.access,
			iat: now,
			mode: "access"
		}

		const access = await new SignJWT(accessPayload)
			.setExpirationTime(Math.floor(now + value.ttl.access))
			.setProtectedHeader({
				alg: signingKeyData.alg,
				kid: signingKeyData.id,
				typ: "JWT"
			})
			.sign(signingKeyData.private)

		return {
			access,
			refresh: [value.subject, refreshToken].join(":"),
			expiresIn: Math.floor(now + value.ttl.access - Date.now() / 1000)
		}
	}

	/**
	 * Gets authorization state from context.
	 */
	const getAuthorization = async (c: Context) => {
		const match = (await auth.get(c, "authorization")) || c.get("authorization")
		if (!match) {
			throw new UnknownStateError()
		}
		return match as AuthorizationState
	}

	/**
	 * Authentication utilities for providers.
	 */
	const auth: Omit<ProviderOptions<unknown>, "name"> = {
		async success(c, properties, successOpts) {
			const authorization = await getAuthorization(c)
			const currentProvider = (c.get("provider") as string | undefined) || "unknown"

			if (!authorization.client_id) {
				throw new Error("client_id is required")
			}

			return await input.success(
				{
					async subject(type, properties, subjectOpts) {
						const subject = subjectOpts?.subject ?? (await resolveSubject(type, properties))
						await successOpts?.invalidate?.(await resolveSubject(type, properties))
						if (!authorization.redirect_uri) {
							throw new Error("redirect_uri is required")
						}
						if (!authorization.client_id) {
							throw new Error("client_id is required")
						}

						const code = generateSecureToken()
						const codePayload = {
							type,
							properties,
							subject,
							redirectURI: authorization.redirect_uri,
							clientID: authorization.client_id,
							scopes: authorization.scopes,
							pkce: authorization.pkce,
							ttl: {
								access: subjectOpts?.ttl?.access ?? ttlAccess,
								refresh: subjectOpts?.ttl?.refresh ?? ttlRefresh
							}
						}

						await Storage.set(storage, ["oauth:code", code], codePayload, 60)

						if (!authorization.redirect_uri) {
							throw new Error("redirect_uri is required")
						}
						const location = new URL(authorization.redirect_uri)
						location.searchParams.set("code", code)
						if (authorization.state) {
							location.searchParams.set("state", authorization.state)
						}
						await auth.unset(c, "authorization")
						return c.redirect(location.toString(), 302)
					}
				},
				{
					provider: currentProvider,
					...(properties && typeof properties === "object" ? properties : {})
				} as Result,
				c.req.raw,
				authorization.client_id
			)
		},

		forward(c, response) {
			return c.newResponse(response.body, response)
		},

		async set(c, key, maxAge, value) {
			const isHttps = isHttpsRequest(c)
			const encryptedValue = await encrypt(value)

			setCookie(c, key, encryptedValue, {
				maxAge,
				httpOnly: true,
				secure: isHttps,
				sameSite: isHttps ? "None" : "Lax",
				path: cookiePath
			})
		},

		async get<T>(c: Context, key: string): Promise<T | undefined> {
			const raw = getCookie(c, key)
			if (!raw) {
				return undefined
			}
			try {
				const decrypted = await decrypt(raw)
				return decrypted as T
			} catch {
				// If decryption fails, clear the invalid cookie
				deleteCookie(c, key, {
					path: cookiePath
				})
				return undefined
			}
		},

		async unset(c: Context, key: string) {
			deleteCookie(c, key, {
				path: cookiePath
			})
		},

		async invalidate(subject: string) {
			for await (const [key] of Storage.scan(storage, ["oauth:refresh", subject])) {
				await Storage.remove(storage, key)
			}
		},

		storage
	}

	// Create main Hono app with basePath support
	const app = new Hono<{ Variables: { authorization: AuthorizationState; provider: string } }>(
		{
			strict: false
		}
	).basePath(input.basePath || "/")

	// Setup provider routes
	for (const [name, value] of Object.entries(input.providers)) {
		const route = new Hono<{ Variables: { provider: string } }>()

		route.use(async (c, next) => {
			c.set("provider", name)
			await next()
		})

		value.init(route, {
			name,
			...auth
		})

		app.route(`/${name}`, route)
	}

	// JWKS endpoint
	app.get(
		"/.well-known/jwks.json",
		cors({
			origin: "*",
			allowHeaders: ["*"],
			allowMethods: ["GET"],
			credentials: false
		}),
		async (c) => {
			const signingKeysData = await allSigning()

			const jwksDocument = {
				keys: signingKeysData.map((keyInfo) => ({
					...keyInfo.jwk,
					alg: keyInfo.alg,
					exp: keyInfo.expired ? Math.floor(keyInfo.expired.getTime() / 1000) : undefined
				}))
			}

			return c.json(jwksDocument)
		}
	)

	// OAuth Authorization Server Metadata
	app.get(
		"/.well-known/oauth-authorization-server",
		cors({
			origin: "*",
			allowHeaders: ["*"],
			allowMethods: ["GET"],
			credentials: false
		}),
		(c) => {
			const iss = issuerUrl(c)

			const oauth2Document = {
				issuer: iss,
				authorization_endpoint: `${iss}/authorize`,
				token_endpoint: `${iss}/token`,
				jwks_uri: `${iss}/.well-known/jwks.json`,
				response_types_supported: ["code"]
			}

			return c.json(oauth2Document)
		}
	)

	// Token endpoint
	app.post(
		"/token",
		cors({
			origin: "*",
			allowHeaders: ["*"],
			allowMethods: ["POST"],
			credentials: false
		}),
		async (c) => {
			const form = await c.req.formData()
			const grantType = form.get("grant_type")

			// Authorization Code Grant
			if (grantType === "authorization_code") {
				const code = form.get("code")
				if (!code) {
					const err = new OauthError("invalid_request", "Missing code")
					return c.json(err.toJSON(), 400)
				}

				const key = ["oauth:code", code.toString()]

				// Validate code with timing normalization to prevent timing attacks
				const { isValid, payload } = await normalizeTimingAsync(async () => {
					const data = await Storage.get<CodeStoragePayload>(storage, key)

					const redirectUri = form.get("redirect_uri")
					const clientId = form.get("client_id")

					const valid = !!(
						data &&
						data.redirectURI === redirectUri &&
						data.clientID === clientId
					)

					return {
						isValid: valid,
						payload: valid ? data : undefined
					}
				})

				if (!isValid || !payload) {
					const err = new OauthError(
						"invalid_grant",
						"Authorization code has been used or expired"
					)
					return c.json(err.toJSON(), 400)
				}

				// PKCE validation
				if (payload.pkce) {
					const codeVerifier = form.get("code_verifier")?.toString()
					if (!codeVerifier) {
						const err = new OauthError("invalid_grant", "Missing code_verifier")
						return c.json(err.toJSON(), 400)
					}

					if (
						!(await validatePKCE(codeVerifier, payload.pkce.challenge, payload.pkce.method))
					) {
						const err = new OauthError("invalid_grant", "Code verifier does not match")
						return c.json(err.toJSON(), 400)
					}
				}

				const tokens = await generateTokens(c, payload)

				// Remove used authorization code
				await Storage.remove(storage, key)

				const response: Record<string, string | number> = {
					access_token: tokens.access,
					token_type: "Bearer",
					expires_in: tokens.expiresIn,
					refresh_token: tokens.refresh
				}

				return c.json(response)
			}

			// Refresh Token Grant
			if (grantType === "refresh_token") {
				const refreshToken = form.get("refresh_token")
				if (!refreshToken) {
					const err = new OauthError("invalid_request", "Missing refresh_token")
					return c.json(err.toJSON(), 400)
				}

				const refreshTokenStr = refreshToken.toString()

				const splits = refreshTokenStr.split(":")
				const token = splits.pop()
				if (!token) {
					throw new Error("Invalid refresh token format")
				}
				const subject = splits.join(":")
				const key = ["oauth:refresh", subject, token]
				const payload = await Storage.get<RefreshTokenStoragePayload>(storage, key)

				if (!payload) {
					const err = new OauthError("invalid_grant", "Refresh token has been used or expired")
					return c.json(err.toJSON(), 400)
				}

				// Execute refresh callback if provided
				if (input.refresh) {
					try {
						const refreshResult = await input.refresh(
							{
								type: payload.type,
								properties: payload.properties,
								subject: payload.subject,
								clientID: payload.clientID,
								scopes: payload.scopes
							},
							c.req.raw
						)

						if (!refreshResult) {
							await auth.invalidate(subject)
							return c.json(
								{
									error: "invalid_grant",
									error_description: "Refresh token is no longer valid"
								},
								400
							)
						}

						// Update payload with refresh result
						payload.type = refreshResult.type
						payload.properties = refreshResult.properties
						if (refreshResult.subject) {
							payload.subject = refreshResult.subject
						}
						if (refreshResult.scopes) {
							payload.scopes = refreshResult.scopes
						}
					} catch {
						return c.json(
							{
								error: "server_error",
								error_description: "Internal server error during token refresh"
							},
							500
						)
					}
				}

				// Handle refresh token reuse logic
				const generateRefreshToken = !payload.timeUsed
				if (ttlRefreshReuse <= 0) {
					await Storage.remove(storage, key)
				} else if (!payload.timeUsed) {
					payload.timeUsed = Date.now()
					await Storage.set(storage, key, payload, ttlRefreshReuse + ttlRefreshRetention)
				} else if (Date.now() > payload.timeUsed + ttlRefreshReuse * 1000) {
					await auth.invalidate(subject)
					return c.json(
						{
							error: "invalid_grant",
							error_description: "Refresh token has been used or expired"
						},
						400
					)
				}

				const tokens = await generateTokens(
					c,
					{
						type: payload.type,
						properties: payload.properties,
						subject: payload.subject,
						clientID: payload.clientID,
						ttl: {
							access: ttlAccess,
							refresh: ttlRefresh
						}
					},
					{
						generateRefreshToken
					}
				)

				const response: Record<string, string | number> = {
					access_token: tokens.access,
					token_type: "Bearer",
					refresh_token: tokens.refresh,
					expires_in: tokens.expiresIn
				}

				return c.json(response)
			}

			return c.json(
				{
					error: "unsupported_grant_type",
					error_description:
						"The authorization grant type is not supported by the authorization server"
				},
				400
			)
		}
	)

	// Authorize endpoint
	app.get("/authorize", async (c) => {
		const provider = c.req.query("provider")
		const response_type = c.req.query("response_type")
		const redirect_uri = c.req.query("redirect_uri")
		const state = c.req.query("state")
		const client_id = c.req.query("client_id")
		const audience = c.req.query("audience")
		const code_challenge = c.req.query("code_challenge")
		const code_challenge_method = c.req.query("code_challenge_method")
		const scope = c.req.query("scope")
		const scopes = scope ? scope.split(" ").filter(Boolean) : undefined

		const authorization: AuthorizationState = {
			response_type,
			redirect_uri,
			state,
			client_id,
			audience,
			scope,
			scopes,
			...(code_challenge &&
				code_challenge_method && {
					pkce: {
						challenge: code_challenge,
						method: code_challenge_method as "S256"
					}
				})
		} as AuthorizationState

		c.set("authorization", authorization)

		// Parameter validation
		if (!redirect_uri) {
			return c.text("Missing redirect_uri", 400)
		}

		// Validate redirect_uri format
		try {
			const uri = new URL(redirect_uri)
			if (!uri.protocol || !uri.host) {
				return c.text("Invalid redirect_uri format", 400)
			}
		} catch {
			return c.text("Invalid redirect_uri format", 400)
		}

		if (!response_type) {
			throw new MissingParameterError("response_type")
		}

		if (response_type !== "code") {
			throw new OauthError(
				"unsupported_response_type",
				`Unsupported response_type: ${response_type}`
			)
		}

		if (!client_id) {
			throw new MissingParameterError("client_id")
		}

		// Execute start callback
		if (input.start) {
			await input.start(c.req.raw)
		}

		// Client authorization check
		if (
			!(await allow()(
				{
					clientID: client_id,
					redirectURI: redirect_uri,
					audience
				},
				c.req.raw
			))
		) {
			throw new UnauthorizedClientError(client_id, redirect_uri)
		}

		// Store authorization state (15 minutes)
		await auth.set(c, "authorization", 60 * 15, authorization)

		// Handle provider selection
		if (provider) {
			return c.redirect(`${provider}/authorize`)
		}

		const availableProviders = Object.keys(input.providers)
		if (availableProviders.length === 1) {
			return c.redirect(`${availableProviders[0]}/authorize`)
		}

		// Show provider selection UI
		return auth.forward(
			c,
			await select()(
				Object.fromEntries(
					Object.entries(input.providers).map(([key, value]) => [key, value.type])
				),
				c.req.raw
			)
		)
	})

	// Error handling
	app.onError(async (err, c) => {
		if (err instanceof UnknownStateError) {
			return auth.forward(c, await error(err, c.req.raw))
		}

		try {
			const authorization = await getAuthorization(c)
			if (!authorization.redirect_uri) {
				throw new Error("redirect_uri is required")
			}
			const url = new URL(authorization.redirect_uri)
			const oauth =
				err instanceof OauthError ? err : new OauthError("server_error", err.message)
			url.searchParams.set("error", oauth.error)
			url.searchParams.set("error_description", oauth.description)
			if (authorization.state) {
				url.searchParams.set("state", authorization.state)
			}
			return c.redirect(url.toString())
		} catch {
			return c.json(
				{
					error: "server_error",
					error_description: err.message
				},
				500
			)
		}
	})

	return app
}
