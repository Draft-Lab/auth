/**
 * Core issuer implementation.
 */

import { Router } from "@draftlab/auth-router"
import { deleteCookie, getCookie, setCookie } from "@draftlab/auth-router/cookies"
import { cors } from "@draftlab/auth-router/middleware/cors"
import type { RouterContext } from "@draftlab/auth-router/types"
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
import { PluginManager } from "./plugin/manager"
import type { Plugin } from "./plugin/types"
import type { Provider, ProviderOptions, ProviderRoute } from "./provider/provider"
import { generateSecureToken } from "./random"
import { Storage, type StorageAdapter } from "./storage/storage"
import type { SubjectPayload, SubjectSchema } from "./subject"
import { setTheme, type Theme } from "./themes/theme"
import type {
	CodeStoragePayload,
	RefreshTokenStoragePayload,
	TokenGenerationResult
} from "./types"
import { Select } from "./ui/select"
import { getRelativeUrl, lazy, type Prettify } from "./util"

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
 * Authorization state for OAuth 2.0 flows.
 */
export interface AuthorizationState {
	/** OAuth redirect URI */
	redirect_uri: string
	/** OAuth response type */
	response_type: string
	/** OAuth state parameter for CSRF protection */
	state: string
	/** OAuth client identifier */
	client_id: string
	/** OAuth audience parameter */
	audience: string
	/** PKCE challenge data for code verification */
	pkce?: {
		challenge: string
		method: "S256"
	}
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
	/** Base path for embedded scenarios */
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
	/** Plugin configuration */
	plugins?: readonly Plugin[]
	/**
	 * Refresh callback for updating user claims.
	 *
	 * @example
	 * ```typescript
	 * refresh: async (payload, req) => {
	 *   const user = await getUserBySubject(payload.subject)
	 *   if (!user || !user.active) {
	 *     return undefined // Revoke the token
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
 *
 * @param ctx - Router context containing request headers and URL
 * @returns True if request is HTTPS, false otherwise
 *
 * @example
 * ```ts
 * if (isHttpsRequest(ctx)) {
 *   setCookie(ctx, 'secure-cookie', value, { secure: true })
 * }
 * ```
 */
const isHttpsRequest = (ctx: RouterContext): boolean => {
	return (
		ctx.header("x-forwarded-proto") === "https" ||
		ctx.header("x-forwarded-ssl") === "on" ||
		ctx.request.url.startsWith("https://")
	)
}

/**
 * Create an Draft Auth server, a Router app that handles OAuth 2.0 flows.
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
): Router<{ Variables: { authorization: AuthorizationState } }> => {
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

	/**
	 * Resolves issuer URL from context.
	 * Returns the base URL for the OAuth issuer, considering basePath configuration.
	 */
	const issuer = (ctx: RouterContext): string => {
		const baseUrl = new URL(getRelativeUrl(ctx, "/"))

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
		ctx: RouterContext,
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
			/**
			 * Generate and store the next refresh token after the one we are currently returning.
			 * Reserving these in advance avoids concurrency issues with multiple refreshes.
			 * Similar treatment should be given to any other values that may have race conditions,
			 * for example if a jti claim was added to the access token.
			 */
			const refreshPayload = {
				type: value.type,
				properties: value.properties,
				clientID: value.clientID,
				subject: value.subject,
				ttl: value.ttl,
				nextToken: generateSecureToken()
				// timeUsed: value.timeUsed
			}

			const refreshKey = ["oauth:refresh", value.subject, refreshToken]
			await Storage.set(storage, refreshKey, refreshPayload, value.ttl.refresh)
		}

		const signingKeyData = await signingKey()
		if (!signingKeyData) {
			throw new Error("Signing key not available")
		}

		const now = Math.floor(Date.now() / 1000)

		// client must be present and non-empty
		if (!value.clientID.trim()) {
			throw new Error("Invalid audience: client ID cannot be empty")
		}

		const accessPayload = {
			type: value.type,
			properties: value.properties,
			sub: value.subject,
			aud: value.clientID,
			iss: issuer(ctx),
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
	const getAuthorization = async (ctx: RouterContext) => {
		const match = (await auth.get(ctx, "authorization")) || ctx.get("authorization")
		if (!match) {
			throw new UnknownStateError()
		}
		return match as AuthorizationState
	}

	/**
	 * Authentication utilities for providers.
	 */
	const auth: Omit<ProviderOptions<unknown>, "name"> = {
		async success(ctx, properties, successOpts) {
			const authorization = await getAuthorization(ctx)
			const currentProvider = ctx.get("provider") || "unknown"

			if (!authorization.client_id) {
				throw new Error("client_id is required")
			}

			return await input.success(
				{
					async subject(type, properties, subjectOpts) {
						const subject = subjectOpts?.subject ?? (await resolveSubject(type, properties))
						await successOpts?.invalidate?.(await resolveSubject(type, properties))

						// Handle different response types
						if (authorization.response_type === "token") {
							if (!authorization.redirect_uri) {
								throw new Error("redirect_uri is required")
							}
							const location = new URL(authorization.redirect_uri)
							if (!authorization.client_id) {
								throw new Error("client_id is required")
							}

							const tokens = await generateTokens(ctx, {
								type,
								subject,
								properties,
								clientID: authorization.client_id,
								ttl: {
									access: subjectOpts?.ttl?.access ?? ttlAccess,
									refresh: subjectOpts?.ttl?.refresh ?? ttlRefresh
								}
							})

							location.hash = new URLSearchParams({
								access_token: tokens.access,
								token_type: "Bearer",
								expires_in: tokens.expiresIn.toString(),
								...(authorization.state && { state: authorization.state })
							}).toString()
							await auth.unset(ctx, "authorization")
							return ctx.redirect(location.toString(), 302)
						}

						// Default: authorization code flow
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
						await auth.unset(ctx, "authorization")
						return ctx.redirect(location.toString(), 302)
					}
				},
				{
					provider: currentProvider,
					...(properties && typeof properties === "object" ? properties : {})
				} as Result,
				ctx.request,
				authorization.client_id
			)
		},

		forward(ctx, response) {
			return ctx.newResponse(response.body ?? undefined, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers
			})
		},

		async set(ctx, key, maxAge, value) {
			const isHttps = isHttpsRequest(ctx)
			const encryptedValue = await encrypt(value)

			setCookie(ctx, key, encryptedValue, {
				maxAge,
				httpOnly: true,
				secure: isHttps,
				sameSite: isHttps ? "None" : "Lax",
				path: input.basePath || "/"
			})
		},

		async get<T>(ctx: RouterContext, key: string): Promise<T | undefined> {
			const raw = getCookie(ctx, key)
			if (!raw) {
				return undefined
			}
			try {
				const decrypted = await decrypt(raw)
				return decrypted as T
			} catch {
				// If decryption fails, clear the invalid cookie
				deleteCookie(ctx, key, {
					path: input.basePath || "/"
				})
				return undefined
			}
		},

		async unset(ctx: RouterContext, key: string) {
			deleteCookie(ctx, key, {
				path: input.basePath || "/"
			})
		},

		async invalidate(subject: string) {
			for await (const [key] of Storage.scan(storage, ["oauth:refresh", subject])) {
				await Storage.remove(storage, key)
			}
		},

		storage
	}

	// Create main router app
	const app = new Router<{ Variables: { authorization: AuthorizationState } }>({
		basePath: input.basePath
	})

	// Initialize plugin manager if plugins are provided
	if (input.plugins && input.plugins.length > 0) {
		const manager = new PluginManager(input.storage)

		// Register all plugins
		for (const plugin of input.plugins) {
			manager.register(plugin)
		}

		// Setup routes
		manager.setupRoutes(app)
	}

	// Setup provider routes
	for (const [name, value] of Object.entries(input.providers)) {
		const route = new Router<{ Variables: { provider: string } }>()

		route.use(async (c, next) => {
			c.set("provider", name)
			return await next()
		})

		value.init(route as unknown as ProviderRoute, {
			name,
			...auth
		})

		app.mount(`/${name}`, route)
	}

	app.get("/.well-known/jwks.json", {
		middleware: [
			cors({
				origin: "*",
				allowHeaders: ["*"],
				allowMethods: ["GET"],
				credentials: false
			})
		],
		handler: async (c) => {
			const signingKeys = await allSigning()

			const jwksDocument = {
				keys: signingKeys.map((keyInfo) => ({
					...keyInfo.jwk,
					alg: keyInfo.alg,
					exp: keyInfo.expired ? Math.floor(keyInfo.expired.getTime() / 1000) : undefined
				}))
			}

			return c.json(jwksDocument)
		}
	})

	app.get("/.well-known/oauth-authorization-server", {
		middleware: [
			cors({
				origin: "*",
				allowHeaders: ["*"],
				allowMethods: ["GET"],
				credentials: false
			})
		],
		handler: (c) => {
			const iss = issuer(c)

			const oauth2Document = {
				issuer: iss,
				authorization_endpoint: `${iss}/authorize`,
				token_endpoint: `${iss}/token`,
				jwks_uri: `${iss}/.well-known/jwks.json`,
				response_types_supported: ["code", "token"]
			}

			return c.json(oauth2Document)
		}
	})

	app.post("/token", {
		middleware: [
			cors({
				origin: "*",
				allowHeaders: ["*"],
				allowMethods: ["POST"],
				credentials: false
			})
		],
		handler: async (c) => {
			const form = await c.formData()
			const grantType = form.get("grant_type")

			// Authorization Code Grant
			if (grantType === "authorization_code") {
				const code = form.get("code")
				if (!code) {
					const error = new OauthError("invalid_request", "Missing code")
					return c.json(error.toJSON(), { status: 400 })
				}

				const key = ["oauth:code", code.toString()]
				const payload = await Storage.get<CodeStoragePayload>(storage, key)
				if (!payload) {
					const error = new OauthError(
						"invalid_grant",
						"Authorization code has been used or expired"
					)
					return c.json(error.toJSON(), { status: 400 })
				}

				// Validate redirect URI
				if (payload.redirectURI !== form.get("redirect_uri")) {
					const error = new OauthError("invalid_redirect_uri", "Redirect URI mismatch")
					return c.json(error.toJSON(), { status: 400 })
				}

				if (payload.clientID !== form.get("client_id")) {
					const error = new OauthError(
						"unauthorized_client",
						"Client is not authorized to use this authorization code"
					)
					return c.json(error.toJSON(), { status: 400 })
				}

				// PKCE validation
				if (payload.pkce) {
					const codeVerifier = form.get("code_verifier")?.toString()
					if (!codeVerifier) {
						const error = new OauthError("invalid_grant", "Missing code_verifier")
						return c.json(error.toJSON(), { status: 400 })
					}

					if (
						!(await validatePKCE(codeVerifier, payload.pkce.challenge, payload.pkce.method))
					) {
						const error = new OauthError("invalid_grant", "Code verifier does not match")
						return c.json(error.toJSON(), { status: 400 })
					}
				}

				const tokens = await generateTokens(c, payload)

				// Remove used authorization code
				await Storage.remove(storage, key)

				const response: Record<string, string | number> = {
					access_token: tokens.access,
					expires_in: tokens.expiresIn,
					refresh_token: tokens.refresh
				}

				return c.json(response)
			}

			// Refresh Token Grant
			if (grantType === "refresh_token") {
				const refreshToken = form.get("refresh_token")
				if (!refreshToken) {
					const error = new OauthError("invalid_request", "Missing refresh_token")
					return c.json(error.toJSON(), { status: 400 })
				}

				const splits = refreshToken.toString().split(":")
				const token = splits.pop()
				if (!token) {
					throw new Error("Invalid refresh token format")
				}
				const subject = splits.join(":")
				const key = ["oauth:refresh", subject, token]
				const payload = await Storage.get<RefreshTokenStoragePayload>(storage, key)

				if (!payload) {
					const error = new OauthError(
						"invalid_grant",
						"Refresh token has been used or expired"
					)
					return c.json(error.toJSON(), { status: 400 })
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
							c.request
						)

						if (!refreshResult) {
							await auth.invalidate(subject)
							return c.json(
								{
									error: "invalid_grant",
									error_description: "Refresh token is no longer valid"
								},
								{ status: 400 }
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

						// Update properties directly from refresh result
						payload.properties = refreshResult.properties
					} catch {
						return c.json(
							{
								error: "server_error",
								error_description: "Internal server error during token refresh"
							},
							{ status: 500 }
						)
					}
				}

				// Handle refresh token reuse logic
				const generateRefreshToken = !payload.timeUsed
				if (ttlRefreshReuse <= 0) {
					// No reuse interval, remove the refresh token immediately
					await Storage.remove(storage, key)
				} else if (!payload.timeUsed) {
					payload.timeUsed = Date.now()
					await Storage.set(storage, key, payload, ttlRefreshReuse + ttlRefreshRetention)
				} else if (Date.now() > payload.timeUsed + ttlRefreshReuse * 1000) {
					// Token was reused past the allowed interval
					await auth.invalidate(subject)
					return c.json(
						{
							error: "invalid_grant",
							error_description: "Refresh token has been used or expired"
						},
						{ status: 400 }
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
				{ status: 400 }
			)
		}
	})

	app.get("/authorize", async (c) => {
		const provider = c.query("provider")
		const response_type = c.query("response_type")
		const redirect_uri = c.query("redirect_uri")
		const state = c.query("state")
		const client_id = c.query("client_id")
		const audience = c.query("audience")
		const code_challenge = c.query("code_challenge")
		const code_challenge_method = c.query("code_challenge_method")
		const scope = c.query("scope")
		const authorization: AuthorizationState = {
			response_type,
			redirect_uri,
			state,
			client_id,
			audience,
			scope,
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
			return c.text("Missing redirect_uri", { status: 400 })
		}

		if (!response_type) {
			throw new MissingParameterError("response_type")
		}

		if (!client_id) {
			throw new MissingParameterError("client_id")
		}

		// Execute start callback
		if (input.start) {
			await input.start(c.request)
		}

		// Client authorization check
		if (
			!(await allow()(
				{
					clientID: client_id,
					redirectURI: redirect_uri,
					audience
				},
				c.request
			))
		) {
			throw new UnauthorizedClientError(client_id, redirect_uri)
		}

		// Store authorization state
		await auth.set(c, "authorization", 60 * 60 * 24, authorization)

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
				c.request
			)
		)
	})

	// Error handling
	app.onError(async (err, c) => {
		if (err instanceof UnknownStateError) {
			return auth.forward(c, await error(err, c.request))
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
				{ status: 500 }
			)
		}
	})

	return app
}
