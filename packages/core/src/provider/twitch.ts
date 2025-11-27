/**
 * Twitch authentication provider for Draft Auth.
 * Implements OAuth 2.0 flow for authenticating users with their Twitch accounts.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { TwitchProvider } from "@draftlab/auth/provider/twitch"
 *
 * export default issuer({
 *   providers: {
 *   basePath: "/auth", // Important for callback URL
 *     twitch: TwitchProvider({
 *       clientID: process.env.TWITCH_CLIENT_ID,
 *       clientSecret: process.env.TWITCH_CLIENT_SECRET,
 *       scopes: ["user:read:email"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/twitch/callback`
 * - Production: `https://yourapp.com/auth/twitch/callback`
 *
 * Register this URL in your Twitch Developer Console.
 *
 * ## Common Scopes
 *
 * - `user:read:email` - Access user's email address
 * - `user:read:subscriptions` - View user subscriptions
 * - `user:read:follows` - View user's follows
 * - `channel:read:subscriptions` - View channel subscribers
 * - `analytics:read:games` - View game analytics
 * - `bits:read` - View bits information
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "twitch") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user information
 *     const userResponse = await fetch('https://api.twitch.tv/helix/users', {
 *       headers: {
 *         'Authorization': `Bearer ${accessToken}`,
 *         'Client-ID': process.env.TWITCH_CLIENT_ID
 *       }
 *     })
 *     const { data } = await userResponse.json()
 *     const user = data[0]
 *
 *     // User info available: id, login, display_name, email, profile_image_url
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Twitch OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Twitch-specific documentation.
 */
export interface TwitchConfig extends Oauth2WrappedConfig {
	/**
	 * Twitch application client ID.
	 * Get this from your Twitch Console at https://dev.twitch.tv/console
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "abcdef123456"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Twitch application client secret.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.TWITCH_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Twitch OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "user:read:email",           // Access user email
	 *     "user:read:subscriptions"    // View subscriptions
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]
}

/**
 * Creates a Twitch OAuth 2.0 authentication provider.
 * Allows users to authenticate using their Twitch accounts.
 *
 * @param config - Twitch OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Twitch
 *
 * @example
 * ```ts
 * // Basic Twitch authentication
 * const basicTwitch = TwitchProvider({
 *   clientID: process.env.TWITCH_CLIENT_ID,
 *   clientSecret: process.env.TWITCH_CLIENT_SECRET
 * })
 *
 * // Twitch with email scope
 * const twitchWithEmail = TwitchProvider({
 *   clientID: process.env.TWITCH_CLIENT_ID,
 *   clientSecret: process.env.TWITCH_CLIENT_SECRET,
 *   scopes: ["user:read:email"]
 * })
 *
 * // Using the access token to fetch user data
 * export default issuer({
 *   providers: { twitch: twitchWithEmail },
 *   success: async (ctx, value) => {
 *     if (value.provider === "twitch") {
 *       const token = value.tokenset.access
 *
 *       const userRes = await fetch('https://api.twitch.tv/helix/users', {
 *         headers: {
 *           'Authorization': `Bearer ${token}`,
 *           'Client-ID': process.env.TWITCH_CLIENT_ID
 *         }
 *       })
 *       const { data } = await userRes.json()
 *       const user = data[0]
 *
 *       return ctx.subject("user", {
 *         twitchId: user.id,
 *         login: user.login,
 *         email: user.email,
 *         displayName: user.display_name
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/twitch/callback`
 * - Production: `https://yourapp.com/auth/twitch/callback`
 *
 * Register this URL in your Twitch Developer Console.
 */
export const TwitchProvider = (config: TwitchConfig) => {
	return Oauth2Provider({
		...config,
		type: "twitch",
		endpoint: {
			authorization: "https://id.twitch.tv/oauth2/authorize",
			token: "https://id.twitch.tv/oauth2/token"
		}
	})
}
