import type { OAuthStrategy } from "./strategy"

/**
 * Google OAuth 2.0 / OpenID Connect strategy.
 *
 * @see https://developers.google.com/identity/protocols/oauth2
 */
export const GoogleStrategy: OAuthStrategy = {
	name: "google",
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
	userInfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo",
	scopes: ["openid", "email", "profile"]
}
