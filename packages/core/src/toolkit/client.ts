/**
 * Lightweight OAuth 2.0 client toolkit for DraftAuth.
 *
 * Provides a simple, framework-agnostic way to implement OAuth 2.0 authentication
 * with PKCE support. Works in both client-side (SPA) and server-side (Next.js, Remix) environments.
 *
 * @example
 * ```ts
 * // Client-side SPA (React, Vue, Solid, etc.)
 * import { createOAuthClient } from '@draftlab/auth/toolkit/client'
 * import { GitHubStrategy, GoogleStrategy } from '@draftlab/auth/toolkit/providers'
 * import { createSessionStorage } from '@draftlab/auth/toolkit/storage'
 *
 * const client = createOAuthClient({
 *   providers: {
 *     github: {
 *       strategy: GitHubStrategy,
 *       clientId: 'YOUR_CLIENT_ID',
 *       clientSecret: 'YOUR_CLIENT_SECRET',
 *       redirectUri: 'http://localhost:3000/auth/callback'
 *     },
 *     google: {
 *       strategy: GoogleStrategy,
 *       clientId: 'YOUR_CLIENT_ID',
 *       clientSecret: 'YOUR_CLIENT_SECRET',
 *       redirectUri: 'http://localhost:3000/auth/callback'
 *     }
 *   },
 *   storage: createSessionStorage()
 * })
 *
 * // Initiate login
 * const { url } = await client.authorize('github', { scopes: ['user:email'] })
 * window.location.href = url
 *
 * // Handle callback
 * const result = await client.handleCallback(window.location.href)
 * console.log(result.accessToken, result.provider)
 * ```
 *
 * @example
 * ```ts
 * // Server-side (Next.js App Router)
 * import { createOAuthClient } from '@draftlab/auth/toolkit/client'
 * import { GitHubStrategy } from '@draftlab/auth/toolkit/providers'
 * import { createCookieStorage } from '@draftlab/auth/toolkit/storage'
 * import { cookies } from 'next/headers'
 *
 * export async function GET(req: Request) {
 *   const client = createOAuthClient({
 *     providers: {
 *       github: {
 *         strategy: GitHubStrategy,
 *         clientId: process.env.GITHUB_CLIENT_ID!,
 *         clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *         redirectUri: 'https://myapp.com/auth/callback'
 *       }
 *     },
 *     storage: createCookieStorage({
 *       getCookie: (name) => cookies().get(name)?.value ?? null,
 *       setCookie: (name, value, opts) => cookies().set(name, value, opts),
 *       deleteCookie: (name) => cookies().delete(name)
 *     })
 *   })
 *
 *   const { url } = await client.authorize('github')
 *   return Response.redirect(url)
 * }
 * ```
 */

import { generatePKCE } from "../pkce"
import type { OAuth2TokenResponse, OAuthStrategy } from "./providers/strategy"
import { type AuthStorage, createSessionStorage } from "./storage"
import { generateSecureRandom } from "./utils"

/**
 * Configuration for a single OAuth provider.
 */
export interface ProviderConfig<TStrategy extends OAuthStrategy> {
	/** OAuth strategy defining endpoints and defaults */
	readonly strategy: TStrategy
	/** OAuth client ID from provider */
	readonly clientId: string
	/** OAuth client secret from provider */
	readonly clientSecret: string
	/** Redirect URI registered with provider */
	readonly redirectUri: string
	/** Optional default scopes for this provider */
	readonly scopes?: string[]
}

/**
 * Options for initiating OAuth authorization flow.
 */
export interface AuthorizeOptions {
	/** Optional scopes to request (overrides provider defaults) */
	readonly scopes?: string[]
	/** Optional additional parameters to include in authorization URL */
	readonly params?: Record<string, string>
	/** Optional nonce for additional security */
	readonly nonce?: string
}

/**
 * Result of successful OAuth callback handling.
 */
export interface CallbackResult {
	/** OAuth provider that was used */
	readonly provider: string
	/** Access token from provider */
	readonly accessToken: string
	/** Optional refresh token from provider */
	readonly refreshToken?: string
	/** Token expiration time in seconds */
	readonly expiresIn?: number
	/** Token type (usually "Bearer") */
	readonly tokenType?: string
	/** Optional ID token (OpenID Connect) */
	readonly idToken?: string
}

/**
 * OAuth 2.0 client configuration.
 */
export interface OAuthClientConfig<
	TProviders extends Record<string, ProviderConfig<OAuthStrategy>>
> {
	/** Provider configurations keyed by provider name */
	readonly providers: TProviders
	/** Storage adapter for PKCE state (defaults to sessionStorage in browser) */
	readonly storage?: AuthStorage
}

/**
 * OAuth 2.0 client for managing authentication flows.
 */
export interface OAuthClient<
	TProviders extends Record<string, ProviderConfig<OAuthStrategy>>
> {
	/**
	 * Initiate OAuth authorization flow.
	 *
	 * @param provider - Provider name (key from providers config)
	 * @param options - Authorization options
	 * @returns Authorization URL to redirect user to
	 *
	 * @example
	 * ```ts
	 * // Basic usage
	 * const { url } = await client.authorize('github')
	 * window.location.href = url
	 *
	 * // With custom scopes
	 * const { url } = await client.authorize('google', {
	 *   scopes: ['openid', 'email', 'profile']
	 * })
	 *
	 * // With additional params
	 * const { url } = await client.authorize('github', {
	 *   params: { prompt: 'consent' }
	 * })
	 * ```
	 */
	authorize(
		provider: (string & {}) | keyof TProviders,
		options?: AuthorizeOptions
	): Promise<{ url: string; state: string }>

	/**
	 * Handle OAuth callback and exchange code for tokens.
	 *
	 * @param callbackUrl - Full callback URL with query parameters
	 * @returns Token exchange result
	 *
	 * @throws {Error} If callback URL is invalid, state mismatch, or token exchange fails
	 *
	 * @example
	 * ```ts
	 * // Client-side
	 * const result = await client.handleCallback(window.location.href)
	 * console.log(result.accessToken, result.provider)
	 *
	 * // Server-side (Next.js)
	 * export async function GET(req: Request) {
	 *   const result = await client.handleCallback(req.url)
	 *   // Store tokens, create session, etc.
	 *   return Response.redirect('/')
	 * }
	 * ```
	 */
	handleCallback(callbackUrl: string): Promise<CallbackResult>

	/**
	 * Get user info from OAuth provider using access token.
	 *
	 * @param provider - Provider name
	 * @param accessToken - Access token from provider
	 * @returns User info from provider
	 *
	 * @example
	 * ```ts
	 * const userInfo = await client.getUserInfo('github', accessToken)
	 * console.log(userInfo.email, userInfo.name)
	 * ```
	 */
	getUserInfo(
		provider: (string & {}) | keyof TProviders,
		accessToken: string
	): Promise<Record<string, unknown>>
}

/**
 * Creates an OAuth 2.0 client for managing authentication flows.
 *
 * Supports PKCE (Proof Key for Code Exchange) for enhanced security.
 * Works in both client-side (browser) and server-side (Node.js) environments.
 *
 * @param config - OAuth client configuration
 * @returns OAuth client instance
 *
 * @example
 * ```ts
 * import { createOAuthClient } from '@draftlab/auth/toolkit/client'
 * import { GitHubStrategy, GoogleStrategy } from '@draftlab/auth/toolkit/providers'
 *
 * const client = createOAuthClient({
 *   providers: {
 *     github: {
 *       strategy: GitHubStrategy,
 *       clientId: 'YOUR_CLIENT_ID',
 *       clientSecret: 'YOUR_CLIENT_SECRET',
 *       redirectUri: 'http://localhost:3000/auth/callback'
 *     },
 *     google: {
 *       strategy: GoogleStrategy,
 *       clientId: 'YOUR_CLIENT_ID',
 *       clientSecret: 'YOUR_CLIENT_SECRET',
 *       redirectUri: 'http://localhost:3000/auth/callback',
 *       scopes: ['openid', 'email', 'profile']
 *     }
 *   }
 * })
 *
 * // Initiate login
 * const { url } = await client.authorize('github')
 *
 * // Handle callback
 * const result = await client.handleCallback(callbackUrl)
 * ```
 */
export const createOAuthClient = <
	TProviders extends Record<string, ProviderConfig<OAuthStrategy>>
>(
	config: OAuthClientConfig<TProviders>
): OAuthClient<TProviders> => {
	// Default to sessionStorage in browser, memory storage in Node
	const storage =
		config.storage || (typeof sessionStorage !== "undefined" ? createSessionStorage() : null)

	if (!storage) {
		throw new Error(
			"No storage adapter provided. Please provide a storage adapter for server-side environments."
		)
	}

	return {
		async authorize(provider, options) {
			const providerConfig = config.providers[provider]
			if (!providerConfig) {
				throw new Error(`Provider '${String(provider)}' not configured`)
			}

			// Generate PKCE challenge
			const pkce = await generatePKCE()

			// Generate state for CSRF protection
			const state = generateSecureRandom(16)

			// Store PKCE state
			await storage.set({
				state,
				verifier: pkce.verifier,
				provider: String(provider),
				nonce: options?.nonce
			})

			// Build authorization URL
			const scopes = options?.scopes || providerConfig.scopes || providerConfig.strategy.scopes
			const params = new URLSearchParams({
				client_id: providerConfig.clientId,
				redirect_uri: providerConfig.redirectUri,
				response_type: "code",
				scope: Array.isArray(scopes) ? scopes.join(" ") : scopes,
				state,
				code_challenge: pkce.challenge,
				code_challenge_method: pkce.method,
				...options?.params
			})

			const url = `${providerConfig.strategy.authorizationEndpoint}?${params.toString()}`

			return { url, state }
		},

		async handleCallback(callbackUrl) {
			const url = new URL(callbackUrl)
			const code = url.searchParams.get("code")
			const state = url.searchParams.get("state")
			const error = url.searchParams.get("error")
			const errorDescription = url.searchParams.get("error_description")

			// Handle OAuth errors
			if (error) {
				throw new Error(
					`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`
				)
			}

			// Validate required parameters
			if (!code || !state) {
				throw new Error("Invalid callback URL: missing code or state parameter")
			}

			// Retrieve and clear stored PKCE state
			const storedState = await storage.get()
			await storage.clear()

			if (!storedState) {
				throw new Error(
					"No stored PKCE state found. OAuth flow may have expired or been tampered with."
				)
			}

			// Validate state (CSRF protection)
			if (state !== storedState.state) {
				throw new Error("State mismatch. Possible CSRF attack detected.")
			}

			const providerConfig = config.providers[storedState.provider]
			if (!providerConfig) {
				throw new Error(`Provider '${storedState.provider}' from callback not configured`)
			}

			// Exchange authorization code for tokens
			const tokenParams = new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: providerConfig.redirectUri,
				client_id: providerConfig.clientId,
				client_secret: providerConfig.clientSecret,
				code_verifier: storedState.verifier
			})

			const tokenResponse = await fetch(providerConfig.strategy.tokenEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Accept: "application/json"
				},
				body: tokenParams
			})

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text()
				throw new Error(`Token exchange failed (${tokenResponse.status}): ${errorText}`)
			}

			const tokenData = (await tokenResponse.json()) as OAuth2TokenResponse

			if (!tokenData.access_token) {
				throw new Error("No access token in provider response")
			}

			return {
				provider: storedState.provider,
				accessToken: tokenData.access_token,
				refreshToken: tokenData.refresh_token,
				expiresIn: tokenData.expires_in,
				tokenType: tokenData.token_type,
				idToken: tokenData.id_token
			}
		},

		async getUserInfo(provider, accessToken) {
			const providerConfig = config.providers[provider]
			if (!providerConfig) {
				throw new Error(`Provider '${String(provider)}' not configured`)
			}

			if (!providerConfig.strategy.userInfoEndpoint) {
				throw new Error(`Provider '${String(provider)}' does not support user info endpoint`)
			}

			const response = await fetch(providerConfig.strategy.userInfoEndpoint, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/json"
				}
			})

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`Failed to fetch user info (${response.status}): ${errorText}`)
			}

			return response.json() as Promise<Record<string, unknown>>
		}
	}
}
