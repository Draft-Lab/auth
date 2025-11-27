/**
 * Vercel OAuth 2.0 + OpenID Connect authentication provider for Draft Auth.
 * Implements "Sign in with Vercel" for user authentication.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { VercelProvider } from "@draftlab/auth/provider/vercel"
 *
 * export default issuer({
 *   basePath: "/auth", // Important for callback URL
 *   providers: {
 *     vercel: VercelProvider({
 *       clientID: process.env.VERCEL_CLIENT_ID,
 *       clientSecret: process.env.VERCEL_CLIENT_SECRET,
 *       scopes: ["openid", "email", "profile"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Example: `http://localhost:3000/auth/vercel/callback`
 * - Production: `https://yourapp.com/auth/vercel/callback`
 *
 * ## Creating a Vercel App
 *
 * Before using this provider, create a Vercel App in your dashboard:
 *
 * 1. Go to **Team Settings** → **Apps** → **Create**
 * 2. Fill in app name, description, and logo
 * 3. Add **Authorization Callback URLs**:
 *    - Development: `http://localhost:3000/auth/vercel/callback`
 *    - Production: `https://yourapp.com/auth/vercel/callback`
 *    - Pattern: `{baseURL}{basePath}/{provider}/callback`
 * 4. Configure **Scopes** in the app's Permissions page:
 *    - ✅ openid (Required)
 *    - ✅ email
 *    - ✅ profile
 *    - ✅ offline_access (optional, for refresh tokens)
 * 5. Generate a **Client Secret** in the Authentication tab
 * 6. Copy the **Client ID** and **Client Secret**
 *
 * **Important**: You must enable the scopes in the Vercel App dashboard before requesting them!
 *
 * ## Available Scopes
 *
 * - `openid` - **Required**. Enables ID Token issuance for user identification
 * - `email` - Access user's email address in ID Token
 * - `profile` - Access user's name, username, and avatar in ID Token
 * - `offline_access` - Issue a Refresh Token for long-lived access (30 days)
 *
 * ## Tokens Returned
 *
 * - **ID Token**: Signed JWT with user identity claims (verified automatically)
 * - **Access Token**: Bearer token for Vercel API calls (1 hour duration)
 * - **Refresh Token**: Rotates on each use (30 days, requires offline_access scope)
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "vercel") {
 *     // ID Token is automatically validated (signature, issuer, audience, expiration)
 *     const idToken = value.tokenset.raw.id_token as string | undefined
 *     const accessToken = value.tokenset.access
 *     const refreshToken = value.tokenset.refresh
 *
 *     // Decode ID Token to access user claims
 *     if (idToken) {
 *       const claims = JSON.parse(
 *         Buffer.from(idToken.split('.')[1], 'base64').toString()
 *       )
 *
 *       // Claims available (depending on scopes):
 *       // - sub: Unique Vercel user ID (always present)
 *       // - email: User's email (if email scope granted)
 *       // - name: User's full name (if profile scope granted)
 *       // - picture: Avatar URL (if profile scope granted)
 *       // - preferred_username: Vercel username (if profile scope granted)
 *
 *       return ctx.subject("user", {
 *         email: claims.email || claims.sub
 *       })
 *     }
 *   }
 * }
 * ```
 *
 * ## Calling Vercel API
 *
 * Use the access token to call Vercel's REST API:
 *
 * ```ts
 * // Get user information
 * const userRes = await fetch('https://api.vercel.com/v2/user', {
 *   headers: { Authorization: `Bearer ${accessToken}` }
 * })
 *
 * // Get user's teams
 * const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
 *   headers: { Authorization: `Bearer ${accessToken}` }
 * })
 *
 * // Get projects (requires appropriate permissions)
 * const projectsRes = await fetch('https://api.vercel.com/v9/projects', {
 *   headers: { Authorization: `Bearer ${accessToken}` }
 * })
 * ```
 *
 * ## Consent Page
 *
 * The first time a user signs in, Vercel shows a consent page with:
 * - Your app's name and logo
 * - Requested scopes and permissions
 * - Allow/Cancel buttons
 *
 * If the user grants access, they're redirected back with an authorization code.
 * If they cancel, they're redirected with an error parameter.
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Vercel OAuth 2.0 + OpenID Connect provider.
 * Extends the base OAuth 2.0 configuration with Vercel-specific documentation.
 */
export interface VercelConfig extends Oauth2WrappedConfig {
	/**
	 * Vercel OAuth App client ID.
	 * Found in your Vercel App settings under the Authentication tab.
	 *
	 * To create an app:
	 * 1. Go to Team Settings → Apps → Create
	 * 2. Configure app details and callback URLs
	 * 3. Copy the Client ID from the Authentication tab
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "oac_abc123xyz789" // Vercel OAuth App Client ID
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Vercel OAuth App client secret.
	 * Generated in your Vercel App settings under the Authentication tab.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * To generate:
	 * 1. Go to your app's Authentication tab
	 * 2. Click "Generate Client Secret"
	 * 3. Copy and store securely (shown only once)
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.VERCEL_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * OpenID Connect scopes to request.
	 * Controls what user information is included in the ID Token.
	 *
	 * Available scopes (must be enabled in Vercel App dashboard first):
	 * - `openid`: Required for ID Token issuance
	 * - `email`: User's email address
	 * - `profile`: Name, username, and avatar
	 * - `offline_access`: Refresh token for long-lived access (optional)
	 *
	 * **Important**: Enable scopes in: Vercel App → Permissions page
	 *
	 * @example
	 * ```ts
	 * {
	 *   // Basic scopes (usually sufficient)
	 *   scopes: ["openid", "email", "profile"]
	 *
	 *   // With refresh token support (enable offline_access in dashboard first)
	 *   scopes: ["openid", "email", "profile", "offline_access"]
	 * }
	 * ```
	 */
	readonly scopes: string[]

	/**
	 * Additional query parameters for Vercel OAuth authorization.
	 * Useful for customizing the authorization flow.
	 *
	 * @example
	 * ```ts
	 * {
	 *   query: {
	 *     prompt: "consent"  // Force consent screen every time
	 *   }
	 * }
	 * ```
	 */
	readonly query?: Record<string, string>
}

/**
 * Creates a Vercel OAuth 2.0 + OpenID Connect authentication provider.
 * Implements "Sign in with Vercel" for user authentication.
 *
 * This provider uses the standard OAuth 2.0 Authorization Code Grant flow
 * with PKCE (Proof Key for Code Exchange) for enhanced security.
 *
 * @param config - Vercel OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Vercel
 *
 * @example
 * ```ts
 * // Basic Vercel authentication (email + profile)
 * const basicVercel = VercelProvider({
 *   clientID: process.env.VERCEL_CLIENT_ID,
 *   clientSecret: process.env.VERCEL_CLIENT_SECRET,
 *   scopes: ["openid", "email", "profile"]
 * })
 *
 * // Vercel with refresh token support
 * const vercelWithRefresh = VercelProvider({
 *   clientID: process.env.VERCEL_CLIENT_ID,
 *   clientSecret: process.env.VERCEL_CLIENT_SECRET,
 *   scopes: ["openid", "email", "profile", "offline_access"]
 * })
 *
 * // Minimal setup (only user ID in ID Token)
 * const minimalVercel = VercelProvider({
 *   clientID: process.env.VERCEL_CLIENT_ID,
 *   clientSecret: process.env.VERCEL_CLIENT_SECRET,
 *   scopes: ["openid"] // Only sub claim in ID Token
 * })
 *
 * // Using the tokens in your app
 * export default issuer({
 *   providers: { vercel: vercelWithRefresh },
 *   success: async (ctx, value) => {
 *     if (value.provider === "vercel") {
 *       const idToken = value.tokenset.raw.id_token as string | undefined
 *       const accessToken = value.tokenset.access
 *       const refreshToken = value.tokenset.refresh
 *
 *       if (idToken) {
 *         // Decode ID Token to access user claims
 *         // (Already validated by oauth2.ts - signature, issuer, audience, exp)
 *         const claims = JSON.parse(
 *           Buffer.from(idToken.split('.')[1], 'base64').toString()
 *         )
 *
 *         // Claims available (depending on scopes):
 *         // - sub: Vercel user ID (always present)
 *         // - email: user@example.com (if email scope)
 *         // - name: "John Doe" (if profile scope)
 *         // - picture: "https://..." (if profile scope)
 *         // - preferred_username: "johndoe" (if profile scope)
 *
 *         // Optionally call Vercel API for more data
 *         const userRes = await fetch('https://api.vercel.com/v2/user', {
 *           headers: { Authorization: `Bearer ${accessToken}` }
 *         })
 *         const user = await userRes.json()
 *
 *         // Get user's teams
 *         const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
 *           headers: { Authorization: `Bearer ${accessToken}` }
 *         })
 *         const teams = await teamsRes.json()
 *
 *         return ctx.subject("user", {
 *           vercelId: claims.sub,
 *           email: claims.email,
 *           name: claims.name,
 *           username: claims.preferred_username,
 *           avatar: claims.picture,
 *           teamCount: teams.teams?.length || 0
 *         })
 *       }
 *     }
 *   }
 * })
 * ```
 *
 * @remarks
 * - Requires creating a Vercel App in Team Settings → Apps
 * - PKCE is enabled by default for enhanced security
 * - ID Token is automatically validated (signature, issuer, audience, expiration)
 * - Access tokens expire after 1 hour
 * - Refresh tokens rotate on each use and last 30 days
 * - The `openid` scope is required for ID Token issuance
 */
export const VercelProvider = (config: VercelConfig) => {
	return Oauth2Provider({
		...config,
		type: "vercel",
		endpoint: {
			authorization: "https://vercel.com/oauth/authorize",
			token: "https://api.vercel.com/login/oauth/token",
			jwks: "https://vercel.com/.well-known/jwks.json"
		},
		// Enable PKCE for enhanced security (recommended by Vercel)
		pkce: true
	})
}
