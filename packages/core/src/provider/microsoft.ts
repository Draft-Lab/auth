/**
 * Microsoft OAuth 2.0 authentication provider for Draft Auth.
 * Supports Microsoft personal accounts, work accounts, and Azure AD.
 * Provides access tokens for calling Microsoft Graph APIs on behalf of users.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { MicrosoftProvider } from "@draftlab/auth/provider/microsoft"
 *
 * export default issuer({
 *   providers: {
 *     microsoft: MicrosoftProvider({
 *       tenant: "common", // or specific tenant ID
 *       clientID: process.env.MICROSOFT_CLIENT_ID,
 *       clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
 *       scopes: ["openid", "profile", "email", "User.Read"]
 *     })
 *   }
 * })
 * ```
 *
 * ## Tenant Configuration
 *
 * - `common` - Both personal and work/school accounts
 * - `organizations` - Work/school accounts only
 * - `consumers` - Personal Microsoft accounts only
 * - `{tenant-id}` - Specific Azure AD tenant only
 *
 * ## Common Scopes
 *
 * - `openid` - Basic OpenID Connect sign-in
 * - `profile` - User's basic profile information
 * - `email` - User's email address
 * - `User.Read` - Read user's profile via Microsoft Graph
 * - `Mail.Read` - Read user's mail
 * - `Calendars.Read` - Read user's calendars
 * - `Files.Read` - Read user's files in OneDrive
 * - `Sites.Read.All` - Read SharePoint sites
 * - `Directory.Read.All` - Read directory data (requires admin consent)
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "microsoft") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user profile via Microsoft Graph
 *     const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const user = await userResponse.json()
 *
 *     // Fetch user photo (requires User.Read scope)
 *     const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const photoBlob = await photoResponse.blob()
 *
 *     // User info: user.displayName, user.mail, user.userPrincipalName
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Microsoft OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Microsoft-specific documentation.
 */
export interface MicrosoftConfig extends Oauth2WrappedConfig {
	/**
	 * Microsoft Azure AD tenant ID or tenant type.
	 * Determines which types of accounts can sign in.
	 *
	 * @example
	 * ```ts
	 * {
	 *   tenant: "common"        // Personal + work/school accounts
	 *   // or
	 *   tenant: "organizations" // Work/school accounts only
	 *   // or
	 *   tenant: "consumers"     // Personal accounts only
	 *   // or
	 *   tenant: "12345678-1234-1234-1234-123456789012" // Specific tenant
	 * }
	 * ```
	 */
	readonly tenant: string

	/**
	 * Microsoft OAuth 2.0 client ID from Azure App Registration.
	 * Found in your Azure portal app registration.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "12345678-1234-1234-1234-123456789012"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Microsoft OAuth 2.0 client secret from Azure App Registration.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.MICROSOFT_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Microsoft OAuth scopes to request access for.
	 * Determines what data and actions your app can access via Microsoft Graph.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "openid",           // OpenID Connect sign-in
	 *     "profile",          // Basic profile
	 *     "email",            // Email address
	 *     "User.Read",        // Read user profile
	 *     "Mail.Read",        // Read user mail
	 *     "Calendars.Read"    // Read user calendars
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]

	/**
	 * Additional query parameters for Microsoft OAuth authorization.
	 * Useful for Microsoft-specific options like domain hints.
	 *
	 * @example
	 * ```ts
	 * {
	 *   query: {
	 *     domain_hint: "contoso.com",    // Pre-fill domain
	 *     login_hint: "user@contoso.com", // Pre-fill username
	 *     prompt: "consent"              // Force consent screen
	 *   }
	 * }
	 * ```
	 */
	readonly query?: Record<string, string>
}

/**
 * Creates a Microsoft OAuth 2.0 authentication provider.
 * Use this when you need access tokens to call Microsoft Graph APIs on behalf of the user.
 *
 * @param config - Microsoft OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Microsoft
 *
 * @example
 * ```ts
 * // Basic Microsoft authentication (all account types)
 * const basicMicrosoft = MicrosoftProvider({
 *   tenant: "common",
 *   clientID: process.env.MICROSOFT_CLIENT_ID,
 *   clientSecret: process.env.MICROSOFT_CLIENT_SECRET
 * })
 *
 * // Work/school accounts only
 * const workMicrosoft = MicrosoftProvider({
 *   tenant: "organizations",
 *   clientID: process.env.MICROSOFT_CLIENT_ID,
 *   clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
 *   scopes: [
 *     "openid",
 *     "profile",
 *     "email",
 *     "User.Read",
 *     "Mail.Read"
 *   ]
 * })
 *
 * // Specific tenant with advanced scopes
 * const enterpriseMicrosoft = MicrosoftProvider({
 *   tenant: "12345678-1234-1234-1234-123456789012",
 *   clientID: process.env.MICROSOFT_CLIENT_ID,
 *   clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
 *   scopes: [
 *     "openid",
 *     "profile",
 *     "email",
 *     "User.Read",
 *     "Directory.Read.All",
 *     "Sites.Read.All"
 *   ],
 *   query: {
 *     domain_hint: "contoso.com"
 *   }
 * })
 *
 * // Using the access token to fetch data
 * export default issuer({
 *   providers: { microsoft: workMicrosoft },
 *   success: async (ctx, value) => {
 *     if (value.provider === "microsoft") {
 *       const token = value.tokenset.access
 *
 *       // Get user profile from Microsoft Graph
 *       const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const user = await userRes.json()
 *
 *       // Get user's manager (if available)
 *       const managerRes = await fetch('https://graph.microsoft.com/v1.0/me/manager', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const manager = await managerRes.json()
 *
 *       return ctx.subject("user", {
 *         microsoftId: user.id,
 *         displayName: user.displayName,
 *         email: user.mail || user.userPrincipalName,
 *         jobTitle: user.jobTitle,
 *         department: user.department,
 *         officeLocation: user.officeLocation,
 *         managerName: manager?.displayName
 *       })
 *     }
 *   }
 * })
 * ```
 */
export const MicrosoftProvider = (config: MicrosoftConfig) => {
	return Oauth2Provider({
		...config,
		type: "microsoft",
		endpoint: {
			authorization: `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`,
			token: `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`
		}
	})
}
