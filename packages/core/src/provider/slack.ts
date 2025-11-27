/**
 * Slack authentication provider for Draft Auth.
 * Implements OAuth 2.0 flow for authenticating users with their Slack accounts.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { SlackProvider } from "@draftlab/auth/provider/slack"
 *
 * export default issuer({
 *   providers: {
 *   basePath: "/auth", // Important for callback URL
 *     slack: SlackProvider({
 *       clientID: process.env.SLACK_CLIENT_ID,
 *       clientSecret: process.env.SLACK_CLIENT_SECRET,
 *       scopes: ["users:read", "users:read.email"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/slack/callback`
 * - Production: `https://yourapp.com/auth/slack/callback`
 *
 * Register this URL in your Slack App settings.
 *
 * ## Common Scopes
 *
 * - `users:read` - Access to user profiles
 * - `users:read.email` - Access user email addresses
 * - `team:read` - Access team information
 * - `channels:read` - View channels
 * - `groups:read` - View private channels
 * - `im:read` - View direct messages
 * - `mpim:read` - View group direct messages
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "slack") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user information
 *     const userResponse = await fetch('https://slack.com/api/auth.test', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const userInfo = await userResponse.json()
 *
 *     // Get user details
 *     const userDetailsResponse = await fetch(
 *       `https://slack.com/api/users.info?user=${userInfo.user_id}`,
 *       { headers: { Authorization: `Bearer ${accessToken}` } }
 *     )
 *     const { user } = await userDetailsResponse.json()
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Slack OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Slack-specific documentation.
 */
export interface SlackConfig extends Oauth2WrappedConfig {
	/**
	 * Slack app client ID.
	 * Get this from your Slack App settings at https://api.slack.com/apps
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "123456789.1234567890"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Slack app client secret.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.SLACK_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Slack OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "users:read",           // Access to user profiles
	 *     "users:read.email",     // Access user emails
	 *     "team:read"             // Access team information
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]
}

/**
 * Creates a Slack OAuth 2.0 authentication provider.
 * Allows users to authenticate using their Slack accounts.
 *
 * @param config - Slack OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Slack
 *
 * @example
 * ```ts
 * // Basic Slack authentication
 * const basicSlack = SlackProvider({
 *   clientID: process.env.SLACK_CLIENT_ID,
 *   clientSecret: process.env.SLACK_CLIENT_SECRET
 * })
 *
 * // Slack with user scopes
 * const slackWithScopes = SlackProvider({
 *   clientID: process.env.SLACK_CLIENT_ID,
 *   clientSecret: process.env.SLACK_CLIENT_SECRET,
 *   scopes: ["users:read", "users:read.email", "team:read"]
 * })
 *
 * // Using the access token to fetch user data
 * export default issuer({
 *   providers: { slack: slackWithScopes },
 *   success: async (ctx, value) => {
 *     if (value.provider === "slack") {
 *       const token = value.tokenset.access
 *
 *       // Get basic user info
 *       const authRes = await fetch('https://slack.com/api/auth.test', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const authInfo = await authRes.json()
 *
 *       // Get detailed user info
 *       const userRes = await fetch(
 *         `https://slack.com/api/users.info?user=${authInfo.user_id}`,
 *         { headers: { Authorization: `Bearer ${token}` } }
 *       )
 *       const { user } = await userRes.json()
 *
 *       return ctx.subject("user", {
 *         slackId: user.id,
 *         username: user.name,
 *         realName: user.real_name,
 *         email: user.profile?.email,
 *         workspace: authInfo.team_id
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/slack/callback`
 * - Production: `https://yourapp.com/auth/slack/callback`
 *
 * Register this URL in your Slack App settings.
 */
export const SlackProvider = (config: SlackConfig) => {
	return Oauth2Provider({
		...config,
		type: "slack",
		endpoint: {
			authorization: "https://slack.com/oauth_authorize",
			token: "https://slack.com/api/oauth.v2.access"
		}
	})
}
