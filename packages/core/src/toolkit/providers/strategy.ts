/**
 * OAuth 2.0 strategy interface and types for provider configurations.
 */

/**
 * OAuth 2.0 token response from provider's token endpoint.
 * Based on RFC 6749 Section 5.1.
 */
export interface OAuth2TokenResponse {
	/** The access token issued by the authorization server */
	access_token: string
	/** The type of token (usually "Bearer") */
	token_type?: string
	/** The lifetime in seconds of the access token */
	expires_in?: number
	/** The refresh token for obtaining new access tokens */
	refresh_token?: string
	/** The scope of the access token (space-separated list) */
	scope?: string
	/** OpenID Connect ID token (JWT) */
	id_token?: string
}

/**
 * OAuth 2.0 provider strategy definition.
 * Defines the endpoints and default configuration for an OAuth provider.
 */
export interface OAuthStrategy {
	/** Provider name (e.g., "github", "google") */
	readonly name: string
	/** OAuth authorization endpoint URL */
	readonly authorizationEndpoint: string
	/** OAuth token exchange endpoint URL */
	readonly tokenEndpoint: string
	/** Optional user info endpoint URL (for OpenID Connect) */
	readonly userInfoEndpoint?: string
	/** Default scopes to request */
	readonly scopes: string[]
}
