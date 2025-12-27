/**
 * DraftAuth Toolkit - Lightweight OAuth 2.0 Client
 *
 * A simple, framework-agnostic OAuth 2.0 client with PKCE support.
 * Works in both client-side (browser) and server-side (Node.js) environments.
 *
 * @packageDocumentation
 *
 * @example
 * ```ts
 * // Quick Start - Client-side SPA
 * import { createOAuthClient, GitHubStrategy, createSessionStorage } from '@draftlab/auth/toolkit'
 *
 * const client = createOAuthClient({
 *   providers: {
 *     github: {
 *       strategy: GitHubStrategy,
 *       clientId: 'YOUR_CLIENT_ID',
 *       clientSecret: 'YOUR_CLIENT_SECRET',
 *       redirectUri: 'http://localhost:3000/auth/callback'
 *     }
 *   },
 *   storage: createSessionStorage()
 * })
 *
 * // Login
 * const { url } = await client.authorize('github')
 * window.location.href = url
 *
 * // Callback
 * const result = await client.handleCallback(window.location.href)
 * console.log(result.accessToken)
 * ```
 */

// PKCE
export { generatePKCE } from "../pkce"
export type {
	AuthorizeOptions,
	CallbackResult,
	OAuthClient,
	OAuthClientConfig,
	ProviderConfig
} from "./client"
// Client
export { createOAuthClient } from "./client"
// Strategies
export { FacebookStrategy } from "./providers/facebook"
export { GitHubStrategy } from "./providers/github"
export { GoogleStrategy } from "./providers/google"
export type { OAuth2TokenResponse, OAuthStrategy } from "./providers/strategy"
export type { AuthStorage, PKCEState } from "./storage"
// Storage
export {
	createCookieStorage,
	createLocalStorage,
	createMemoryStorage,
	createSessionStorage
} from "./storage"
// Utils
export { generateSecureRandom } from "./utils"
