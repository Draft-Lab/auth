/**
 * Spotify authentication provider for Draft Auth.
 * Implements OAuth 2.0 flow for authenticating users with their Spotify accounts.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { SpotifyProvider } from "@draftlab/auth/provider/spotify"
 *
 * export default issuer({
 *   providers: {
 *   basePath: "/auth", // Important for callback URL
 *     spotify: SpotifyProvider({
 *       clientID: process.env.SPOTIFY_CLIENT_ID,
 *       clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
 *       scopes: ["user-read-private", "user-read-email"]
 *     })
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/spotify/callback`
 * - Production: `https://yourapp.com/auth/spotify/callback`
 *
 * Register this URL in your Spotify Developer Dashboard.
 *
 * ## Common Scopes
 *
 * - `user-read-private` - Access user's private data
 * - `user-read-email` - Access user's email address
 * - `user-top-read` - Read user's top artists and tracks
 * - `user-read-playback-state` - Read current playback state
 * - `user-modify-playback-state` - Modify playback state
 * - `user-read-currently-playing` - Read currently playing track
 * - `playlist-read-private` - Access private playlists
 * - `playlist-read-public` - Access public playlists
 * - `user-library-read` - Read user's library
 * - `user-follow-read` - Read followed artists and users
 *
 * ## User Data Access
 *
 * ```ts
 * success: async (ctx, value) => {
 *   if (value.provider === "spotify") {
 *     const accessToken = value.tokenset.access
 *
 *     // Fetch user profile
 *     const userResponse = await fetch('https://api.spotify.com/v1/me', {
 *       headers: { Authorization: `Bearer ${accessToken}` }
 *     })
 *     const user = await userResponse.json()
 *
 *     // User info: id, email, display_name, external_urls, images, followers
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Oauth2Provider, type Oauth2WrappedConfig } from "./oauth2"

/**
 * Configuration options for Spotify OAuth 2.0 provider.
 * Extends the base OAuth 2.0 configuration with Spotify-specific documentation.
 */
export interface SpotifyConfig extends Oauth2WrappedConfig {
	/**
	 * Spotify app client ID.
	 * Get this from your Spotify App at https://developer.spotify.com/dashboard
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
	 * Spotify app client secret.
	 * Keep this secure and never expose it to client-side code.
	 *
	 * @example
	 * ```ts
	 * {
	 *   clientSecret: process.env.SPOTIFY_CLIENT_SECRET
	 * }
	 * ```
	 */
	readonly clientSecret: string

	/**
	 * Spotify OAuth scopes to request access for.
	 * Determines what data and actions your app can access.
	 *
	 * @example
	 * ```ts
	 * {
	 *   scopes: [
	 *     "user-read-private",   // Access private user data
	 *     "user-read-email",     // Access user email
	 *     "user-top-read"        // Read top artists and tracks
	 *   ]
	 * }
	 * ```
	 */
	readonly scopes: string[]
}

/**
 * Creates a Spotify OAuth 2.0 authentication provider.
 * Allows users to authenticate using their Spotify accounts.
 *
 * @param config - Spotify OAuth 2.0 configuration
 * @returns OAuth 2.0 provider configured for Spotify
 *
 * @example
 * ```ts
 * // Basic Spotify authentication
 * const basicSpotify = SpotifyProvider({
 *   clientID: process.env.SPOTIFY_CLIENT_ID,
 *   clientSecret: process.env.SPOTIFY_CLIENT_SECRET
 * })
 *
 * // Spotify with user data access
 * const spotifyWithScopes = SpotifyProvider({
 *   clientID: process.env.SPOTIFY_CLIENT_ID,
 *   clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
 *   scopes: ["user-read-private", "user-read-email", "user-top-read"]
 * })
 *
 * // Using the access token to fetch user data
 * export default issuer({
 *   providers: { spotify: spotifyWithScopes },
 *   success: async (ctx, value) => {
 *     if (value.provider === "spotify") {
 *       const token = value.tokenset.access
 *
 *       const userRes = await fetch('https://api.spotify.com/v1/me', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const user = await userRes.json()
 *
 *       // Optionally fetch top tracks
 *       const topRes = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=5', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       })
 *       const { items: topTracks } = await topRes.json()
 *
 *       return ctx.subject("user", {
 *         spotifyId: user.id,
 *         email: user.email,
 *         displayName: user.display_name,
 *         profileUrl: user.external_urls?.spotify,
 *         followers: user.followers?.total,
 *         topTracks: topTracks.map(t => t.name)
 *       })
 *     }
 *   }
 * })
 * ```
 *
 * **Callback URL Pattern**: `{baseURL}{basePath}/{provider}/callback`
 * - Development: `http://localhost:3000/auth/spotify/callback`
 * - Production: `https://yourapp.com/auth/spotify/callback`
 *
 * Register this URL in your Spotify Developer Dashboard.
 */
export const SpotifyProvider = (config: SpotifyConfig) => {
	return Oauth2Provider({
		...config,
		type: "spotify",
		endpoint: {
			authorization: "https://accounts.spotify.com/authorize",
			token: "https://accounts.spotify.com/api/token"
		}
	})
}
