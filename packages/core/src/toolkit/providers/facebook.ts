import type { OAuthStrategy } from "./strategy"

/**
 * Facebook OAuth 2.0 strategy.
 *
 * @see https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 */
export const FacebookStrategy: OAuthStrategy = {
	name: "facebook",
	authorizationEndpoint: "https://www.facebook.com/v23.0/dialog/oauth",
	tokenEndpoint: "https://graph.facebook.com/v23.0/oauth/access_token",
	userInfoEndpoint: "https://graph.facebook.com/me?fields=id,name,email",
	scopes: ["public_profile", "email"]
}
