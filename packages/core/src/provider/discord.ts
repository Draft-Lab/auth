/**
 * Discord OAuth 2.0 authentication provider for Draft Auth.
 * Provides access tokens for calling Discord APIs on behalf of users.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { DiscordProvider } from "@draftlab/auth/provider/discord"
 *
 * export default issuer({
 *   providers: {
 *   basePath: "/auth", // Important for callback URL
 *     discord: DiscordProvider({
 *       clientID: process.env.DISCORD_CLIENT_ID,
 *       clientSecret: process.env.DISCORD_CLIENT_SECRET,
 *       scopes: ["identify", "email", "guilds"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/discord/callback`
 * - Production: `https://yourapp.com/auth/discord/callback`
 *
 * Register this URL in your Discord Developer Portal.
 *
 * ## Common Scopes
 *
 * - `identify` - Access to user's basic account information
 * - `email` - Access to user's email address
 * - `guilds` - Access to user's guilds (servers)
 * - `guilds.join` - Ability to join user to guilds
 * - `gdm.join` - Ability to join user to group DMs
 * - `connections` - Access to user's connections (Steam, YouTube, etc.)
 * - `guilds.members.read` - Read guild member information
 * - `bot` - For bot applications (requires additional setup)
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "discord") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user information
 *     const userResponse = await fetch('https://discord.com/api/users/@me', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const user = await userResponse.json()
 *
 *     // Fetch user guilds (requires guilds scope)
 *     const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const guilds = await guildsResponse.json()
 *
 *     // User info: user.username + user.discriminator
 *     // Avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Discord OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Discord-specific documentation.
 */
export interface DiscordConfig extends Oauth2WrappedConfig {
	/**
	 * Discord OAuth 2.0 client ID from Discord Developer Portal.
	 * Found in your Discord application settings.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientID: "1234567890123456789"
	 * }
	 * ```
	 */
	readonly clientID: string

	/**
	 * Discord OAuth 2.0 client secret from Discord Developer Portal.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.DISCORD_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Discord OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "identify",    // Basic user information
	 *     "email",       // Email address
	 *     "guilds",      // User's Discord servers
	 *     "connections"  // Connected accounts (Steam, etc.)
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]

	/**
	 * Additional query parameters for Discord OAuth authorization.
	 * Useful for Discord-specific options like permissions.
	 *
	 * @example
	 * ```ts
	 * {
	 *   query: {
	 *     permissions: "8",        // Administrator permission
	 *     guild_id: "123456789",   // Pre-select specific guild
	 *     disable_guild_select: "true" // Disable guild selection
	 *   }
	 * }
	 * ```
	 */
	readonly query?: Record<string, string>
}

/**
 * Creates a Discord OAuth 2.0 authentication provider.
 * Use this when you need access tokens to call Discord APIs on behalf of the user.
 *
 * @param config - Discord OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Discord
 *
 * @example
 * ```ts
 * // Basic Discord authentication
 * const basicDiscord = DiscordProvider({
 *   clientID: process.env.DISCORD_CLIENT_ID,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET
 * })
 *
 * // Discord with specific scopes
 * const discordWithScopes = DiscordProvider({
 *   clientID: process.env.DISCORD_CLIENT_ID,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET,
 *   scopes: [
 *     "identify",
 *     "email",
 *     "guilds",
 *     "connections"
 *   ]
 * })
 *
 * // Discord bot integration
 * const discordBot = DiscordProvider({
 *   clientID: process.env.DISCORD_CLIENT_ID,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET,
 *   scopes: ["bot", "guilds"],
 *   query: {
 *     permissions: "2048" // Send Messages permission
 *   }
 * })
 *
 * // Using the access token to fetch data
 * export default issuer({
 *   providers: { discord: discordWithScopes },
 *   success: async (ctx, value) => {
 *     if (value.provider === "discord") {
 *       const token = value.tokenset.access
 *
 *       // Get user profile
 *       const userRes = await fetch('https://discord.com/api/users/@me', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const user = await userRes.json()
 *
 *       // Get user guilds (if guilds scope granted)
 *       const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const guilds = await guildsRes.json()
 *
 *       return ctx.subject("user", {
 *         discordId: user.id,
 *         username: user.username,
 *         discriminator: user.discriminator,
 *         email: user.email,
 *         avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
 *         guildCount: guilds.length
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/discord/callback`
 * - Production: `https://yourapp.com/auth/discord/callback`
 *
 * Register this URL in your Discord Developer Portal.
 */
export const DiscordProvider = (config: DiscordConfig) => {
	return Oauth2Provider({
		...config,
		type: "discord",
		endpoint: {
			authorization: "https://discord.com/oauth2/authorize",
			token: "https://discord.com/api/oauth2/token"
		}
	})
}
