/**
 * Reddit authentication provider for Draft Auth.
 * Implements OAuth 2.0 flow for authenticating users with their Reddit accounts.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { RedditProvider } from "@draftlab/auth/provider/reddit"
 *
 * export default issuer({
 *   providers: {
 *   basePath: "/auth", // Important for callback URL
 *     reddit: RedditProvider({
 *       clientID: process.env.REDDIT_CLIENT_ID,
 *       clientSecret: process.env.REDDIT_CLIENT_SECRET,
 *       scopes: ["identity"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/reddit/callback`
 * - Production: `https://yourapp.com/auth/reddit/callback`
 *
 * Register this URL in your Reddit App Preferences.
 *
 * ## Common Scopes
 *
 * - `identity` - Access user's identity information
 * - `read` - Access user's private data (saved posts, hidden posts, etc.)
 * - `submit` - Submit links and posts
 * - `modposts` - Moderate posts
 * - `privatemessages` - Access private messages
 * - `subscribe` - Subscribe to subreddits
 * - `wikiread` - Read wiki pages
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "reddit") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user information
 *     const userResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const user = await userResponse.json()
 *
 *     // User info: id, name, created_utc, link_karma, comment_karma
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Reddit OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Reddit-specific documentation.
 */
export interface RedditConfig extends Oauth2WrappedConfig {
	/**
	 * Reddit app client ID.
	 * Get this from your Reddit application preferences at https://www.reddit.com/prefs/apps
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
	 * Reddit app client secret.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.REDDIT_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Reddit OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "identity",           // Access user identity
	 *     "read"                // Read private data
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]
}

/**
 * Creates a Reddit OAuth 2.0 authentication provider.
 * Allows users to authenticate using their Reddit accounts.
 *
 * @param config - Reddit OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Reddit
 *
 * @example
 * ```ts
 * // Basic Reddit authentication
 * const basicReddit = RedditProvider({
 *   clientID: process.env.REDDIT_CLIENT_ID,
 *   clientSecret: process.env.REDDIT_CLIENT_SECRET
 * })
 *
 * // Reddit with identity scope
 * const redditWithIdentity = RedditProvider({
 *   clientID: process.env.REDDIT_CLIENT_ID,
 *   clientSecret: process.env.REDDIT_CLIENT_SECRET,
 *   scopes: ["identity"]
 * })
 *
 * // Using the access token to fetch user data
 * export default issuer({
 *   providers: { reddit: redditWithIdentity },
 *   success: async (ctx, value) => {
 *     if (value.provider === "reddit") {
 *       const token = value.tokenset.access
 *
 *       const userRes = await fetch('https://oauth.reddit.com/api/v1/me', {
 *         headers: {
 *           'Authorization': `Bearer ${token}`,
 *           'User-Agent': 'YourApp/1.0'
 *         }
 *       })
 *       const user = await userRes.json()
 *
 *       return ctx.subject("user", {
 *         redditId: user.id,
 *         username: user.name,
 *         linkKarma: user.link_karma,
 *         commentKarma: user.comment_karma
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/reddit/callback`
 * - Production: `https://yourapp.com/auth/reddit/callback`
 *
 * Register this URL in your Reddit App Preferences.
 */
export const RedditProvider = (config: RedditConfig) => {
	return Oauth2Provider({
		...config,
		type: "reddit",
		endpoint: {
			authorization: "https://www.reddit.com/api/v1/authorize",
			token: "https://www.reddit.com/api/v1/access_token"
		}
	})
}
