import type { OAuthStrategy } from "./strategy"

/**
 * GitHub OAuth 2.0 strategy.
 *
 * @see https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 */
export const GitHubStrategy: OAuthStrategy = {
	name: "github",
	authorizationEndpoint: "https://github.com/login/oauth/authorize",
	tokenEndpoint: "https://github.com/login/oauth/access_token",
	userInfoEndpoint: "https://api.github.com/user",
	scopes: ["read:user", "user:email"]
}
