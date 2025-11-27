/**
 * LinkedIn OAuth 2.0 authentication provider for Draft Auth.
 * Provides access tokens for calling LinkedIn APIs on behalf of users.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { LinkedInProvider } from "@draftlab/auth/provider/linkedin"
 *
 * export default issuer({
 *   basePath: "/auth", // Important for callback URL
 *   providers: {
 *     linkedin: LinkedInProvider({
 *       clientID: process.env.LINKEDIN_CLIENT_ID,
 *       clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
 *       scopes: ["r_liteprofile", "r_emailaddress", "w_member_social"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/linkedin/callback`
 * - Production: `https://yourapp.com/auth/linkedin/callback`
 *
 * Register this URL in your LinkedIn Developer Portal.
 *
 * ## Common Scopes
 *
 * - `r_liteprofile` - Access to basic profile information
 * - `r_emailaddress` - Access to user's email address
 * - `r_basicprofile` - Access to full profile information (deprecated)
 * - `w_member_social` - Share content on behalf of user
 * - `r_organization_social` - Access to organization social content
 * - `rw_organization_admin` - Manage organization pages
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "linkedin") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user profile
 *     const profileResponse = await fetch('https://api.linkedin.com/v2/people/~', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const profile = await profileResponse.json()
 *
 *     // Fetch user email (requires r_emailaddress scope)
 *     const emailResponse = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const emailData = await emailResponse.json()
 *
 *     // User info: profile.localizedFirstName + profile.localizedLastName
 *     // Email: emailData.elements[0]['handle~'].emailAddress
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for LinkedIn OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with LinkedIn-specific documentation.
 */
export interface LinkedInConfig extends Oauth2WrappedConfig {
	/**
	 * LinkedIn OAuth 2.0 client ID from LinkedIn Developer Console.
	 * Found in your LinkedIn app settings.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "78abc123456789"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * LinkedIn OAuth 2.0 client secret from LinkedIn Developer Console.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.LINKEDIN_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * LinkedIn OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "r_liteprofile",    // Basic profile information
	 *     "r_emailaddress",   // Email address
	 *     "w_member_social",  // Share content on behalf of user
	 *     "r_organization_social" // Organization content access
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]

	/**
	 * Additional query parameters for LinkedIn OAuth authorization.
	 * Useful for LinkedIn-specific options.
	 *
	 * @example
	 * ```ts
	 * {
	 *   query: {
	 *     state: "custom-state-value" // Custom state parameter
	 *   }
	 * }
	 * ```
	 */
	readonly query?: Record<string, string>
}

/**
 * Creates a LinkedIn OAuth 2.0 authentication provider.
 * Use this when you need access tokens to call LinkedIn APIs on behalf of the user.
 *
 * @param config - LinkedIn OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for LinkedIn
 *
 * @example
 * ```ts
 * // Basic LinkedIn authentication
 * const basicLinkedIn = LinkedInProvider({
 *   clientID: process.env.LINKEDIN_CLIENT_ID,
 *   clientSecret: process.env.LINKEDIN_CLIENT_SECRET
 * })
 *
 * // LinkedIn with specific scopes
 * const linkedInWithScopes = LinkedInProvider({
 *   clientID: process.env.LINKEDIN_CLIENT_ID,
 *   clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
 *   scopes: [
 *     "r_liteprofile",
 *     "r_emailaddress",
 *     "w_member_social"
 *   ]
 * })
 *
 * // Using the access token to fetch data
 * export default issuer({
 *   providers: { linkedin: linkedInWithScopes },
 *   success: async (ctx, value) => {
 *     if (value.provider === "linkedin") {
 *       const token = value.tokenset.access
 *
 *       // Get user profile
 *       const profileRes = await fetch('https://api.linkedin.com/v2/people/~', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const profile = await profileRes.json()
 *
 *       // Get user email
 *       const emailRes = await fetch('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const emailData = await emailRes.json()
 *
 *       return ctx.subject("user", {
 *         linkedinId: profile.id,
 *         firstName: profile.localizedFirstName,
 *         lastName: profile.localizedLastName,
 *         email: emailData.elements[0]['handle~'].emailAddress,
 *         profileUrl: `https://www.linkedin.com/in/${profile.vanityName || profile.id}`
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/linkedin/callback`
 * - Production: `https://yourapp.com/auth/linkedin/callback`
 *
 * Register this URL in your LinkedIn Developer Portal.
 */
export const LinkedInProvider = (config: LinkedInConfig) => {
	return Oauth2Provider({
		...config,
		type: "linkedin",
		endpoint: {
			authorization: "https://www.linkedin.com/oauth/v2/authorization",
			token: "https://www.linkedin.com/oauth/v2/accessToken"
		}
	})
}
