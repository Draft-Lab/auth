/**
 * Facebook OAuth 2.0 authentication provider for Draft Auth.
 * Provides access tokens for calling Facebook Graph API on behalf of users.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { FacebookProvider } from "@draftlab/auth/provider/facebook"
 *
 * export default issuer({
 *   providers: {
 *     facebook: FacebookProvider({
 *       clientID: process.env.FACEBOOK_APP_ID,
 *       clientSecret: process.env.FACEBOOK_APP_SECRET,
 *       scopes: ["email", "public_profile", "user_friends"]
 *     })
 *   }
 * })
 * ```
 *
 * ## Configuration Options
 *
 * - Access tokens for Facebook Graph API calls
 * - Support for various Facebook permissions
 * - Access to user data, posts, friends, etc.
 *
 * ## Common Facebook Permissions
 *
 * - `public_profile` - Basic profile information (name, picture, etc.)
 * - `email` - User's email address
 * - `user_friends` - List of user's friends who also use your app
 * - `user_posts` - User's posts on their timeline
 * - `user_photos` - User's photos and albums
 * - `pages_read_engagement` - Read engagement data for Pages
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "facebook") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user profile from Graph API
 *     const profileResponse = await fetch(
 *       `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
 *     )
 *     const profile = await profileResponse.json()
 *
 *     // User info: `${profile.name} (${profile.email})`
 *     // Facebook ID: profile.id
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Facebook OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Facebook-specific documentation.
 */
export interface FacebookConfig extends Oauth2WrappedConfig {
	/**
	 * Facebook App ID from your Facebook App Dashboard.
	 * This is the public identifier for your Facebook application.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "1234567890123456"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Facebook App Secret from your Facebook App Dashboard.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.FACEBOOK_APP_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Facebook permissions to request during login.
	 * Determines what data your app can access from the user's Facebook account.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "email",           // User's email address
	 *     "public_profile",  // Basic profile info
	 *     "user_friends",    // User's friends list
	 *     "user_posts"       // User's timeline posts
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]

	/**
	 * Additional query parameters for Facebook OAuth authorization.
	 * Useful for Facebook-specific options like response type or display mode.
	 *
	 * @example
	 * ```ts
	 * {
	 *   query: {
	 *     display: "popup",           // Show login in popup
	 *     auth_type: "rerequest",     // Force permission re-request
	 *     state: "custom-state"       // Custom state parameter
	 *   }
	 * }
	 * ```
	 */
	readonly query?: Record<string, string>
}

/**
 * Creates a Facebook OAuth 2.0 authentication provider.
 * Use this when you need access tokens to call Facebook Graph API on behalf of the user.
 *
 * @param config - Facebook OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Facebook
 *
 * @example
 * ```ts
 * // Basic Facebook authentication
 * const basicFacebook = FacebookProvider({
 *   clientID: process.env.FACEBOOK_APP_ID,
 *   clientSecret: process.env.FACEBOOK_APP_SECRET,
 *   scopes: ["email", "public_profile"]
 * })
 *
 * // Facebook with extended permissions
 * const extendedFacebook = FacebookProvider({
 *   clientID: process.env.FACEBOOK_APP_ID,
 *   clientSecret: process.env.FACEBOOK_APP_SECRET,
 *   scopes: [
 *     "email",
 *     "public_profile",
 *     "user_friends",
 *     "user_posts",
 *     "user_photos"
 *   ],
 *   query: {
 *     display: "popup",
 *     auth_type: "rerequest" // Force permission approval
 *   }
 * })
 *
 * // Using the access token for Graph API calls
 * export default issuer({
 *   providers: { facebook: extendedFacebook },
 *   success: async (ctx, value) => {
 *     if (value.provider === "facebook") {
 *       const token = value.tokenset.access
 *
 *       // Get user profile with custom fields
 *       const profileRes = await fetch(
 *         `https://graph.facebook.com/me?fields=id,name,email,picture.width(200),friends&access_token=${token}`
 *       )
 *       const profile = await profileRes.json()
 *
 *       // Get user's posts (if permission granted)
 *       const postsRes = await fetch(
 *         `https://graph.facebook.com/me/posts?access_token=${token}`
 *       )
 *       const posts = await postsRes.json()
 *
 *       return ctx.subject("user", {
 *         facebookId: profile.id,
 *         name: profile.name,
 *         email: profile.email,
 *         picture: profile.picture?.data?.url,
 *         friendsCount: profile.friends?.summary?.total_count || 0,
 *         postsCount: posts.data?.length || 0
 *       })
 *     }
 *   }
 * })
 * ```
 */
export const FacebookProvider = (config: FacebookConfig) => {
	return Oauth2Provider({
		...config,
		type: "facebook",
		endpoint: {
			authorization: "https://www.facebook.com/v18.0/dialog/oauth",
			token: "https://graph.facebook.com/v18.0/oauth/access_token"
		}
	})
}
