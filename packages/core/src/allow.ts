import { isDomainMatch } from "./util"

/**
 * Client validation utilities.
 * Provides default checks to determine if incoming authentication requests should be permitted
 * based on redirect URI validation and hostname matching rules.
 */

/**
 * Input parameters for client-validation checks.
 * Contains all necessary information to decide whether a client request should be permitted.
 */
export interface AllowCheckInput {
	/** The client ID of the application requesting authorization */
	readonly clientID: string
	/** The redirect URI where the user will be sent after sign-in completes */
	readonly redirectURI: string
	/**
	 * Optional audience metadata from the authorization request.
	 *
	 * This is available so custom allow callbacks can apply their own client/resource policy.
	 */
	readonly audience?: string
}

/**
 * Default allow check that validates client requests based on redirect URI safety.
 *
 * ## Security Policy
 * - **Localhost**: Allowed only when the issuer itself is also running on localhost/127.0.0.1
 * - **Same site**: Redirect URI host must share the same last two hostname labels
 * - **Cross-domain**: Rejected for security
 *
 * This prevents unrelated origins from hijacking sign-in callbacks using redirect URIs that do
 * not belong to the same site as the issuer.
 *
 * @param input - Client request details including ID and redirect URI
 * @param req - The original HTTP request for domain comparison
 * @returns Promise resolving to true if the request should be allowed
 *
 * @example
 * ```ts
 * // Allowed: localhost development when the issuer is also local
 * await defaultAllowCheck({
 *   clientID: "dev-app",
 *   redirectURI: "http://localhost:3000/callback"
 * }, request) // → true
 *
 * // Allowed: same site
 * // Request from: https://myapp.com
 * await defaultAllowCheck({
 *   clientID: "web-app",
 *   redirectURI: "https://auth.myapp.com/callback"
 * }, request) // → true
 *
 * // Rejected: different domain
 * // Request from: https://myapp.com
 * await defaultAllowCheck({
 *   clientID: "malicious-app",
 *   redirectURI: "https://evil.com/steal-codes"
 * }, request) // → false
 * ```
 */
export const defaultAllowCheck = (input: AllowCheckInput, req: Request): Promise<boolean> => {
	return Promise.resolve(
		(() => {
			// Extract and validate redirect URI hostname
			let redirectHostname: string
			try {
				redirectHostname = new URL(input.redirectURI).hostname
			} catch {
				return false
			}

			// Allow localhost redirects only when the issuer itself is also local.
			if (redirectHostname === "localhost" || redirectHostname === "127.0.0.1") {
				const requestHost = new URL(req.url).hostname
				return requestHost === "localhost" || requestHost === "127.0.0.1"
			}

			// Extract current request hostname (handling proxy headers)
			let currentHostname: string
			try {
				const forwardedHost = req.headers.get("x-forwarded-host")
				currentHostname = forwardedHost
					? new URL(`https://${forwardedHost}`).hostname
					: new URL(req.url).hostname
			} catch {
				return false
			}

			// Check if redirect URI belongs to the same site according to Draft Auth's lightweight
			// hostname heuristic.
			return isDomainMatch(redirectHostname, currentHostname)
		})()
	)
}
