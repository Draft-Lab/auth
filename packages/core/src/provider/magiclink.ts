/**
 * Magic Link authentication provider for Draft Auth.
 * Sends clickable links that authenticate users in one click.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { MagicLinkUI } from "@draftlab/auth/ui/magiclink"
 * import { MagicLinkProvider } from "@draftlab/auth/provider/magiclink"
 *
 * export default issuer({
 *   providers: {
 *     magiclink: MagicLinkProvider(
 *       MagicLinkUI({
 *         sendLink: async (claims, magicUrl) => {
 *           await emailService.send({
 *             to: claims.email,
 *             subject: "Sign in to your account",
 *             html: `<a href="${magicUrl}">Sign In</a>`
 *           })
 *         }
 *       })
 *     )
 *   }
 * })
 * ```
 *
 * ## Custom Configuration
 *
 * ```ts
 * const customMagicLink = MagicLinkProvider({
 *   expiry: 600, // 10 minutes instead of default 15
 *
 *   request: async (req, state, form, error) => {
 *     return new Response(renderMagicLinkForm(state, form, error))
 *   },
 *
 *   sendLink: async (claims, magicUrl) => {
 *     try {
 *       if (claims.email) {
 *         await emailService.send(claims.email, {
 *           subject: "Your secure sign-in link",
 *           template: "magic-link",
 *           data: { magicUrl, userEmail: claims.email }
 *         })
 *       } else {
 *         return { type: "invalid_claim", key: "email", value: "Email is required" }
 *       }
 *     } catch {
 *       return { type: "invalid_claim", key: "delivery", value: "Failed to send magic link" }
 *     }
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 */

import type { RouterContext } from "@draftlab/auth-router/types"
import { generateUnbiasedDigits, timingSafeCompare } from "../random"
import type { Provider } from "./provider"

/**
 * Configuration options for the Magic Link authentication provider.
 *
 * @template Claims - Type of claims collected during authentication (email, phone, etc.)
 */
export interface MagicLinkConfig<
	Claims extends Record<string, string> = Record<string, string>
> {
	/**
	 * Token expiration time in seconds.
	 * After this time, the magic link becomes invalid.
	 *
	 * @default 900 (15 minutes)
	 */
	readonly expiry?: number

	/**
	 * Request handler for rendering the magic link UI.
	 * Handles both the initial claim collection and "check your email" screens.
	 *
	 * @param req - The HTTP request object
	 * @param state - Current authentication state
	 * @param form - Form data from POST requests (if any)
	 * @param error - Authentication error to display (if any)
	 * @returns Promise resolving to the authentication page response
	 */
	request: (
		req: Request,
		state: MagicLinkState,
		form?: FormData,
		error?: MagicLinkError
	) => Promise<Response>

	/**
	 * Callback for sending magic links to users.
	 * Should handle delivery via email, SMS, or other communication channels.
	 *
	 * @param claims - User claims containing contact information
	 * @param magicUrl - The magic link URL to send
	 * @returns Promise resolving to undefined on success, or error object on failure
	 */
	sendLink: (claims: Claims, magicUrl: string) => Promise<MagicLinkError | undefined>
}

/**
 * Authentication flow states for the magic link provider.
 * The provider transitions between these states during authentication.
 */
export type MagicLinkState =
	| {
			/** Initial state: user enters their claims (email, phone, etc.) */
			readonly type: "start"
	  }
	| {
			/** Link sent state: user checks their email/phone */
			readonly type: "sent"
			/** Whether this is a resend request */
			readonly resend?: boolean
			/** The secure token for verification */
			readonly token: string
			/** User claims collected during the start phase */
			readonly claims: Record<string, string>
	  }

/**
 * Possible errors during magic link authentication.
 */
export type MagicLinkError =
	| {
			/** The magic link is invalid or expired */
			readonly type: "invalid_link"
	  }
	| {
			/** A user claim is invalid or missing */
			readonly type: "invalid_claim"
			/** The claim field that failed validation */
			readonly key: string
			/** The invalid value or error description */
			readonly value: string
	  }

/**
 * User data returned by successful magic link authentication.
 *
 * @template Claims - Type of claims collected during authentication
 */
export interface MagicLinkUserData<
	Claims extends Record<string, string> = Record<string, string>
> {
	/** The verified claims collected during authentication */
	readonly claims: Claims
}

/**
 * Creates a Magic Link authentication provider.
 * Implements a flexible claim-based authentication flow with magic link verification.
 *
 * @template Claims - Type of claims to collect (email, phone, username, etc.)
 * @param config - Magic Link provider configuration
 * @returns Provider instance implementing magic link authentication
 */
export const MagicLinkProvider = <
	Claims extends Record<string, string> = Record<string, string>
>(
	config: MagicLinkConfig<Claims>
): Provider<MagicLinkUserData<Claims>> => {
	/**
	 * Generates a cryptographically secure token.
	 */
	const generateToken = (): string => {
		return generateUnbiasedDigits(32)
	}

	return {
		type: "magiclink",

		init(routes, ctx) {
			/**
			 * Transitions between authentication states and renders the appropriate UI.
			 */
			const transition = async (
				c: RouterContext,
				nextState: MagicLinkState,
				formData?: FormData,
				error?: MagicLinkError
			) => {
				await ctx.set<MagicLinkState>(c, "provider", 60 * 60 * 24, nextState)
				const response = await config.request(c.request, nextState, formData, error)
				return ctx.forward(c, response)
			}

			/**
			 * GET /authorize - Display initial claim collection form
			 */
			routes.get("/authorize", async (c) => {
				return transition(c, { type: "start" })
			})

			/**
			 * POST /authorize - Handle form submissions and state transitions
			 */
			routes.post("/authorize", async (c) => {
				const formData = await c.formData()
				const action = formData.get("action")?.toString()

				// Handle claim submission and link generation
				if (action === "request" || action === "resend") {
					const token = generateToken()
					const formEntries = Object.fromEntries(formData)
					const { action: _, ...claims } = formEntries as Claims & { action?: string }

					// Build magic link URL
					const baseUrl = new URL(c.request.url).origin
					const magicUrl = new URL(`/auth/${ctx.name}/verify`, baseUrl)
					magicUrl.searchParams.set("token", token)
					for (const [key, value] of Object.entries(claims as Record<string, string>)) {
						if (typeof value === "string") {
							magicUrl.searchParams.set(key, value)
						}
					}

					// Send magic link and handle any errors
					const sendError = await config.sendLink(claims as Claims, magicUrl.toString())
					if (sendError) {
						return transition(c, { type: "start" }, formData, sendError)
					}

					return transition(
						c,
						{
							type: "sent",
							resend: action === "resend",
							claims: claims as Record<string, string>,
							token
						},
						formData
					)
				}

				// Default case - return to start
				return transition(c, { type: "start" })
			})

			/**
			 * GET /verify - Handle magic link clicks
			 */
			routes.get("/verify", async (c) => {
				const url = new URL(c.request.url)
				const token = url.searchParams.get("token")
				const storedState = await ctx.get<MagicLinkState>(c, "provider")

				if (!token || !storedState || storedState.type !== "sent") {
					return transition(c, { type: "start" }, undefined, { type: "invalid_link" })
				}

				// Validate token (timing-safe comparison)
				if (!timingSafeCompare(storedState.token, token)) {
					return transition(c, { type: "start" }, undefined, { type: "invalid_link" })
				}

				// Verify claims match URL parameters
				const urlClaims: Record<string, string> = {}
				for (const [key, value] of url.searchParams) {
					if (key !== "token" && value) {
						urlClaims[key] = value
					}
				}

				const claimsMatch = Object.keys(storedState.claims).every((key) => {
					const urlValue = urlClaims[key]
					const storedValue = storedState.claims[key]
					if (!urlValue || !storedValue) return false
					return timingSafeCompare(storedValue, urlValue)
				})

				if (!claimsMatch) {
					return transition(c, { type: "start" }, undefined, { type: "invalid_link" })
				}

				// Magic link verification successful - complete authentication
				await ctx.unset(c, "provider")
				return await ctx.success(c, {
					claims: storedState.claims as Claims
				})
			})
		}
	}
}
