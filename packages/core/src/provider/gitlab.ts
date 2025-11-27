/**
 * GitLab authentication provider for Draft Auth.
 * Implements OAuth 2.0 flow for authenticating users with their GitLab accounts.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { GitlabProvider } from "@draftlab/auth/provider/gitlab"
 *
 * export default issuer({
 *   basePath: "/auth", // Important for callback URL
 *   providers: {
 *     gitlab: GitlabProvider({
 *       clientID: process.env.GITLAB_CLIENT_ID,
 *       clientSecret: process.env.GITLAB_CLIENT_SECRET,
 *       scopes: ["read_user", "read_api"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/gitlab/callback`
 * - Production: `https://yourapp.com/auth/gitlab/callback`
 *
 * Register this URL in your GitLab Application settings.
 *
 * ## Common Scopes
 *
 * - `read_user` - Access user profile
 * - `read_api` - Read-access to the API
 * - `read_repository` - Access to project repositories
 * - `write_repository` - Write access to repositories
 * - `api` - Full API access
 * - `read_user_email` - Access user email
 *
 * ## Self-Hosted GitLab
 *
 * For self-hosted GitLab instances, you can override the endpoint URLs:
 *
 * ```ts
 * const selfHostedGitlab = Oauth2Provider({
 *   clientID: process.env.GITLAB_CLIENT_ID,
 *   clientSecret: process.env.GITLAB_CLIENT_SECRET,
 *   scopes: ["read_user"],
 *   type: "gitlab",
 *   endpoint: {
 *     authorization: "https://your-gitlab.com/oauth/authorize",
 *     token: "https://your-gitlab.com/oauth/token"
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/gitlab/callback`
 * - Production: `https://yourapp.com/auth/gitlab/callback`
 *
 * Register this URL in your GitLab Application settings.
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "gitlab") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user information
 *     const userResponse = await fetch('https://gitlab.com/api/v4/user', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const user = await userResponse.json()
 *
 *     // User info: id, username, email, name, avatar_url
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for GitLab OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with GitLab-specific documentation.
 */
export interface GitlabConfig extends Oauth2WrappedConfig {
	/**
	 * GitLab application client ID.
	 * Get this from your GitLab application settings.
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
	 * GitLab application client secret.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.GITLAB_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * GitLab OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "read_user",        // Access user profile
	 *     "read_api",         // Read-access to API
	 *     "read_repository"   // Access repositories
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]
}

/**
 * Creates a GitLab OAuth 2.0 authentication provider.
 * Allows users to authenticate using their GitLab accounts (gitlab.com or self-hosted).
 *
 * @param config - GitLab OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for GitLab
 *
 * @example
 * ```ts
 * // Basic GitLab.com authentication
 * const basicGitlab = GitlabProvider({
 *   clientID: process.env.GITLAB_CLIENT_ID,
 *   clientSecret: process.env.GITLAB_CLIENT_SECRET
 * })
 *
 * // GitLab with read access
 * const gitlabWithRead = GitlabProvider({
 *   clientID: process.env.GITLAB_CLIENT_ID,
 *   clientSecret: process.env.GITLAB_CLIENT_SECRET,
 *   scopes: ["read_user", "read_api"]
 * })
 *
 * // Using the access token to fetch user data
 * export default issuer({
 *   providers: { gitlab: gitlabWithRead },
 *   success: async (ctx, value) => {
 *     if (value.provider === "gitlab") {
 *       const token = value.tokenset.access
 *
 *       const userRes = await fetch('https://gitlab.com/api/v4/user', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const user = await userRes.json()
 *
 *       return ctx.subject("user", {
 *         gitlabId: user.id,
 *         username: user.username,
 *         email: user.email,
 *         name: user.name,
 *         avatar: user.avatar_url
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/gitlab/callback`
 * - Production: `https://yourapp.com/auth/gitlab/callback`
 *
 * Register this URL in your GitLab Application settings.
 */
export const GitlabProvider = (config: GitlabConfig) => {
	return Oauth2Provider({
		...config,
		type: "gitlab",
		endpoint: {
			authorization: "https://gitlab.com/oauth/authorize",
			token: "https://gitlab.com/oauth/token"
		}
	})
}
