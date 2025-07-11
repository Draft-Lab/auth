/**
 * Google OAuth 2.0 authentication provider for Draft Auth.
 * Provides access tokens for calling Google APIs on behalf of users.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { GoogleProvider } from "@draftlab/auth/provider/google"
 *
 * export default issuer({
 *   providers: {
 *     google: GoogleProvider({
 *       clientID: process.env.GOOGLE_CLIENT_ID,
 *       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
 *       scopes: ["profile", "email", "https://www.googleapis.com/auth/calendar.readonly"]
 *     })
 *   }
 * })
 * ```
 *
 * ## Configuration Options
 *
 * - Access tokens for Google API calls
 * - Refresh tokens for long-lived access
 * - Support for offline access
 * - Custom scopes for specific Google services
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "google") {
 *     // Access token for API calls: value.tokenset.access
 *     // Refresh token (if requested): value.tokenset.refresh
 *     // Use the access token to call Google APIs
 *     const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
 *       headers: { Authorization: `Bearer ${value.tokenset.access}` }
 *     })
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Google OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Google-specific defaults.
 */
export interface GoogleConfig extends Oauth2WrappedConfig {
	/**
	 * Google OAuth 2.0 client ID from Google Cloud Console.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "123456789-abc123.apps.googleusercontent.com"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Google OAuth 2.0 client secret from Google Cloud Console.
	 * Required for server-side OAuth 2.0 flows.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Google OAuth 2.0 scopes to request.
	 * Common scopes include 'profile', 'email', and specific Google API scopes.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "profile",
	 *     "email",
	 *     "https://www.googleapis.com/auth/calendar.readonly",
	 *     "https://www.googleapis.com/auth/drive.file"
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]

	/**
	 * Additional query parameters for Google OAuth 2.0.
	 * Useful for Google-specific options like hosted domain restrictions.
	 *
	 * @example
	 * ```ts
	 * {
	 *   query: {
	 *     hd: "mycompany.com",        // Restrict to Google Workspace domain
	 *     access_type: "offline",     // Request refresh token
	 *     prompt: "consent",          // Force consent screen
	 *     include_granted_scopes: "true" // Incremental authorization
	 *   }
	 * }
	 * ```
	 */
	readonly query?: Record<string, string>
}

/**
 * Creates a Google OAuth 2.0 authentication provider.
 * Use this when you need access tokens to call Google APIs on behalf of the user.
 *
 * @param config - Google OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Google
 *
 * @example
 * ```ts
 * // Basic setup for user authentication
 * const basicGoogle = GoogleProvider({
 *   clientID: process.env.GOOGLE_CLIENT_ID,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET
 * })
 *
 * // Advanced setup with API access
 * const advancedGoogle = GoogleProvider({
 *   clientID: process.env.GOOGLE_CLIENT_ID,
 *   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
 *   scopes: [
 *     "profile",
 *     "email",
 *     "https://www.googleapis.com/auth/calendar.readonly",
 *     "https://www.googleapis.com/auth/drive.file"
 *   ],
 *   query: {
 *     access_type: "offline",    // Get refresh token
 *     prompt: "consent",         // Force consent for refresh token
 *     hd: "mycompany.com"       // Restrict to company domain
 *   }
 * })
 *
 * // Use the access token for API calls
 * success: async (ctx, value) => {
 *   const accessToken = value.tokenset.access
 *   const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
 *     headers: { Authorization: `Bearer ${accessToken}` }
 *   })
 * }
 * ```
 */
export const GoogleProvider = (config: GoogleConfig) => {
	return Oauth2Provider({
		...config,
		type: "google",
		endpoint: {
			authorization: "https://accounts.google.com/o/oauth2/v2/auth",
			token: "https://oauth2.googleapis.com/token",
			jwks: "https://www.googleapis.com/oauth2/v3/certs"
		}
	})
}
