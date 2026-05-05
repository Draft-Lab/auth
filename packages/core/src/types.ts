/**
 * Shared type definitions for Draft Auth core.
 */

/**
 * Authorization state for OAuth 2.0 flows.
 */
export interface AuthorizationState {
	/** OAuth redirect URI */
	redirect_uri?: string
	/** OAuth response type */
	response_type?: "code"
	/** OAuth state parameter for CSRF protection */
	state?: string
	/** OAuth client identifier */
	client_id?: string
	/**
	 * Optional audience metadata from the authorization request.
	 *
	 * Draft Auth currently forwards this to the `allow()` callback but does not mint it into the
	 * access token audience claim by default.
	 */
	audience?: string
	/** Raw scope string from request */
	scope?: string
	/**
	 * Parsed OAuth scopes preserved as authorization metadata.
	 *
	 * These scopes are available to issuer hooks and refresh-token state but are not embedded into
	 * access-token claims by default.
	 */
	scopes?: string[]
	/** PKCE challenge data for code verification */
	pkce?: PKCEChallenge
}

/**
 * Token generation result for OAuth 2.0.
 */
export interface TokenGenerationResult {
	/** OAuth access token */
	access: string
	/** Token expiration time in seconds */
	expiresIn: number
	/** OAuth refresh token */
	refresh: string
}

/**
 * PKCE challenge data for OAuth flows.
 */
export interface PKCEChallenge {
	challenge: string
	method: "S256"
}

/**
 * TTL configuration for tokens and sessions.
 */
export interface TtlConfiguration {
	/** Access token TTL in seconds */
	access: number
	/** Refresh token TTL in seconds */
	refresh: number
}

/**
 * Refresh token storage payload structure.
 * Contains metadata about issued refresh tokens.
 */
export interface RefreshTokenStoragePayload {
	/** Subject type identifier */
	type: string
	/** Subject properties/claims */
	properties: unknown
	/** Resolved subject identifier for JWT */
	subject: string
	/** Client identifier that owns this refresh token */
	clientID: string
	/** Token TTL configuration used when issuing descendants */
	ttl: TtlConfiguration
	/** OAuth scopes metadata associated with this refresh token chain. */
	scopes?: string[]
	/** Encrypted successor refresh token used for rotation */
	nextToken: string
	/** Timestamp when the refresh token was first used */
	timeUsed?: number
}

/**
 * Code storage payload for authorization code grant.
 * Used for storing authorization code data during OAuth flows.
 */
export interface CodeStoragePayload {
	/** Subject type identifier */
	type: string
	/** Subject properties/claims */
	properties: unknown
	/** Resolved subject identifier for JWT */
	subject: string
	/** Redirect URI used in authorization request */
	redirectURI: string
	/** Client identifier */
	clientID: string
	/** OAuth scopes metadata captured during authorization. */
	scopes?: string[]
	/** Token TTL configuration */
	ttl: TtlConfiguration
	/** PKCE challenge data */
	pkce?: PKCEChallenge
}
