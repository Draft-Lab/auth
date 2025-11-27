/**
 * Apple authentication provider for Draft Auth.
 * Implements OAuth 2.0 flow for authenticating users with their Apple accounts.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { AppleProvider } from "@draftlab/auth/provider/apple"
 *
 * export default issuer({
 *   providers: {
 *   basePath: "/auth", // Important for callback URL
 *     apple: AppleProvider({
 *       clientID: process.env.APPLE_CLIENT_ID,
 *       clientSecret: process.env.APPLE_CLIENT_SECRET,
 *       scopes: ["name", "email"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/apple/callback`
 * - Production: `https://yourapp.com/auth/apple/callback`
 *
 * Register this URL in your Apple Developer Portal.
 *
 * ## Setup Instructions
 *
 * ### 1. Create App ID
 * - Go to [Apple Developer](https://developer.apple.com)
 * - Create a new App ID with "Sign in with Apple" capability
 *
 * ### 2. Create Service ID
 * - Create a new Service ID (this is your clientID)
 * - Configure "Sign in with Apple"
 * - Add your redirect URI
 *
 * ### 3. Create Private Key
 * - Create a private key for "Sign in with Apple"
 * - Download the .p8 file (this is used to create your clientSecret)
 *
 * ## Client Secret Generation
 *
 * Apple requires a JWT token as the client secret. You'll need:
 * - Key ID from the private key
 * - Team ID from your Apple Developer account
 * - Private key (.p8 file)
 *
 * Use a library to generate the JWT (valid for ~15 minutes):
 *
 * ```ts
 * import { SignJWT } from "jose"
 *
 * const secret = await new SignJWT({
 *   iss: "YOUR_TEAM_ID",
 *   aud: "https://appleid.apple.com",
 *   sub: process.env.APPLE_CLIENT_ID,
 *   iat: Math.floor(Date.now() / 1000),
 *   exp: Math.floor(Date.now() / 1000) + 15 * 60
 * })
 *   .setProtectedHeader({ alg: "ES256", kid: "YOUR_KEY_ID" })
 *   .sign(privateKey)
 * ```
 *
 * ## Common Scopes
 *
 * - `name` - Access user's name (first and last name)
 * - `email` - Access user's email address
 *
 * Note: Apple only returns user data on the first authorization. Subsequent authorizations won't include name/email.
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "apple") {
 *     const accessToken = value.tokenset.access
 *
 *     // Apple doesn't provide a userinfo endpoint
 *     // User data is returned in the authorization response
 *     // You need to parse the id_token JWT to get user info
 *
 *     // For subsequent logins without name/email, use the subject (user_id)
 *     // from the ID token to identify the user
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Apple OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Apple-specific documentation.
 */
export interface AppleConfig extends Oauth2WrappedConfig {
	/**
	 * Apple Service ID (app identifier for your Sign in with Apple implementation).
	 * Get this from your Apple Developer account when creating a Service ID.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "com.example.app.signin"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Apple client secret (JWT token signed with your private key).
	 * This is different from other providers - Apple requires a JWT token
	 * generated from your private key.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.APPLE_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Apple OAuth scopes to request access for.
	 * Apple only supports "name" and "email" scopes.
	 *
	 * Important: Apple only provides user data (name, email) on the FIRST authorization.
	 * Subsequent authorizations won't include this data.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: ["name", "email"]
	 * }
	 * ```
	 */
	readonly scopes: string[]
}

/**
 * Creates an Apple OAuth 2.0 authentication provider.
 * Allows users to authenticate using their Apple accounts.
 *
 * @param config - Apple OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Apple
 *
 * @example
 * ```ts
 * // Basic Apple authentication
 * const basicApple = AppleProvider({
 *   clientID: process.env.APPLE_CLIENT_ID,
 *   clientSecret: process.env.APPLE_CLIENT_SECRET
 * })
 *
 * // Apple with name and email scopes
 * const appleWithScopes = AppleProvider({
 *   clientID: process.env.APPLE_CLIENT_ID,
 *   clientSecret: process.env.APPLE_CLIENT_SECRET,
 *   scopes: ["name", "email"]
 * })
 *
 * // Using the tokens and id_token
 * export default issuer({
 *   providers: { apple: appleWithScopes },
 *   success: async (ctx, value) => {
 *     if (value.provider === "apple") {
 *       // Apple returns user data in the initial authorization response
 *       // You need to decode the id_token to extract user information
 *
 *       // The id_token contains:
 *       // - sub: unique Apple user identifier
 *       // - email: user email (only on first authorization)
 *       // - email_verified: whether email is verified
 *       // - is_private_email: whether user used private relay
 *
 *       // Decode and verify the id_token using jose:
 *       // const verified = await jwtVerify(value.tokenset.id, jwks)
 *       // const user = verified.payload
 *
 *       return ctx.subject("user", {
 *         appleId: user.sub,
 *         email: user.email,
 *         emailVerified: user.email_verified,
 *         isPrivateEmail: user.is_private_email
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/apple/callback`
 * - Production: `https://yourapp.com/auth/apple/callback`
 *
 * Register this URL in your Apple Developer Portal.
 */
export const AppleProvider = (config: AppleConfig) => {
	return Oauth2Provider({
		...config,
		type: "apple",
		endpoint: {
			authorization: "https://appleid.apple.com/auth/authorize",
			token: "https://appleid.apple.com/auth/token"
		}
	})
}
