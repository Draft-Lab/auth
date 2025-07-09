/**
 * Shared type definitions for Draft Auth core.
 */

/**
 * Authorization state for OAuth 2.0 flows.
 */
export interface AuthorizationState {
	/** OAuth redirect URI */
	redirect_uri?: string
	/** OAuth response type (code, token) */
	response_type?: string
	/** OAuth state parameter for CSRF protection */
	state?: string
	/** OAuth client identifier */
	client_id?: string
	/** OAuth audience parameter */
	audience?: string
	/** Raw scope string from request */
	scope?: string
	/** Parsed OAuth scopes array */
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
	/** OAuth scopes associated with this token */
	scopes?: string[]
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
	/** OAuth scopes */
	scopes?: string[]
	/** Token TTL configuration */
	ttl: TtlConfiguration
	/** PKCE challenge data */
	pkce?: PKCEChallenge
}
