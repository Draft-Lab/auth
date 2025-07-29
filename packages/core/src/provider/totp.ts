/**
 * Configures a provider that supports TOTP (Time-based One-Time Password) authentication.
 *
 * ```ts
 * import { TOTPProvider } from "@draftlab/auth/provider/totp"
 *
 * export default issuer({
 *   providers: {
 *     totp: TOTPProvider({
 *       issuer: "My Application",
 *       setup: async (req, qrCode, secret, backupCodes) => {
 *         return new Response(renderSetupPage(qrCode, secret, backupCodes))
 *       },
 *       verify: async (req, error) => {
 *         return new Response(renderVerifyPage(error))
 *       },
 *       recovery: async (req, error) => {
 *         return new Response(renderRecoveryPage(error))
 *       }
 *     })
 *   },
 *   // ...
 * })
 * ```
 *
 * TOTPProvider implements Time-based One-Time Password authentication.
 * It provides secure TOTP token generation and verification with backup recovery codes.
 *
 * The provider requires configuration of:
 * - Issuer name for authenticator apps
 * - UI handlers for setup, verification, and recovery flows
 * - Optional TOTP parameters (algorithm, digits, period)
 *
 * It automatically manages:
 * - Secure secret generation
 * - QR code URL generation for authenticator apps
 * - Token validation with timing attack protection
 * - Recovery codes generation and one-time usage
 * - Storage of TOTP configuration and backup codes
 *
 * @packageDocumentation
 */

import { Secret, TOTP } from "otpauth"
import { generateSecureToken } from "../random"
import { Storage } from "../storage/storage"
import type { Provider, ProviderOptions, ProviderRoute } from "./provider"

/**
 * TOTP data model stored in the database.
 * Contains the user's TOTP configuration and backup codes.
 */
export interface TOTPModel {
	/** Base32-encoded secret key */
	secret: string
	/** Whether TOTP is enabled for this user */
	enabled: boolean
	/** Array of one-time backup/recovery codes */
	backupCodes: string[]
	/** Timestamp when TOTP was first set up */
	createdAt: string
	/** Optional user label for the TOTP */
	label?: string
}

// --- Storage Key Definitions ---
const totpKey = (userId: string) => ["totp", "user", userId]

// Default configuration values
const DEFAULT_CONFIG = {
	algorithm: "SHA1" as const,
	digits: 6,
	period: 30,
	window: 1, // Allow ±30 seconds for clock drift
	backupCodesCount: 4,
	qrSize: 200
}

/**
 * Configuration for the TOTPProvider.
 * Defines how the TOTP authentication flow should behave.
 */
export interface TOTPProviderConfig {
	/**
	 * The human-readable name of the issuer (your application).
	 * This appears in authenticator apps next to the TOTP entry.
	 */
	issuer: string

	/**
	 * Custom authorize handler that generates the UI for TOTP login.
	 * Called when user wants to login with TOTP (main page).
	 *
	 * @param req - The HTTP request object
	 * @param error - Optional error message to display
	 */
	authorize: (req: Request, error?: string) => Promise<Response>

	/**
	 * Custom register handler that generates the UI for TOTP setup.
	 * Called when user is setting up TOTP for the first time.
	 *
	 * @param req - The HTTP request object
	 * @param qrCodeUrl - The otpauth:// URL for QR code generation
	 * @param secret - The raw secret (for manual entry)
	 * @param backupCodes - Array of backup/recovery codes
	 * @param error - Optional error message to display
	 */
	register: (
		req: Request,
		qrCodeUrl: string,
		secret: string,
		backupCodes: string[],
		error?: string,
		email?: string
	) => Promise<Response>

	/**
	 * Custom recovery handler that generates the UI for backup code entry.
	 * Called when user wants to use a recovery code instead of TOTP.
	 *
	 * @param req - The HTTP request object
	 * @param error - Optional error message to display
	 */
	recovery: (req: Request, error?: string) => Promise<Response>

	/**
	 * Optional TOTP algorithm. Defaults to SHA1 for maximum compatibility.
	 * Most authenticator apps support SHA1, fewer support SHA256/SHA512.
	 */
	algorithm?: "SHA1" | "SHA256" | "SHA512"

	/**
	 * Optional number of digits in TOTP codes. Defaults to 6.
	 * Some apps support 8 digits for increased security.
	 */
	digits?: 6 | 8

	/**
	 * Optional validity period for TOTP codes in seconds. Defaults to 30.
	 * Standard is 30 seconds, some high-security apps use 60.
	 */
	period?: number

	/**
	 * Optional time window tolerance for clock drift. Defaults to 1.
	 * Allows tokens from previous/next time window to be valid.
	 */
	window?: number

	/**
	 * Optional number of backup codes to generate. Defaults to 10.
	 */
	backupCodesCount?: number

	/**
	 * Optional function to check if a user is allowed to set up TOTP.
	 */
	userCanSetupTOTP?: (userId: string, req: Request) => Promise<boolean>

	/**
	 * Optional custom label generator for TOTP entries.
	 * Defaults to using the userId as the label.
	 */
	generateLabel?: (userId: string) => Promise<string>
}

/**
 * Creates a TOTP (Time-based One-Time Password) authentication provider.
 *
 * TOTP tokens. Users can set up TOTP using any compatible authenticator app
 * and use backup codes when their primary device is unavailable.
 *
 * It handles:
 * - TOTP secret generation and QR code creation
 * - Token verification with timing attack protection
 * - Backup code generation and one-time usage validation
 * - Complete setup, verification, and recovery flows
 *
 * @param config Configuration options for the TOTP provider
 * @returns A Provider instance configured for TOTP authentication
 */
export const TOTPProvider = (
	config: TOTPProviderConfig
): Provider<{ email: string; method: "totp" | "recovery" }> => {
	const {
		issuer,
		algorithm = DEFAULT_CONFIG.algorithm,
		digits = DEFAULT_CONFIG.digits,
		period = DEFAULT_CONFIG.period,
		window = DEFAULT_CONFIG.window,
		backupCodesCount = DEFAULT_CONFIG.backupCodesCount
	} = config

	return {
		type: "totp",
		init(
			routes: ProviderRoute,
			ctx: ProviderOptions<{
				email: string
				method: "totp" | "recovery"
			}>
		) {
			// --- Internal Helper Functions ---

			const getTOTPData = async (userId: string): Promise<TOTPModel | null> => {
				return await Storage.get<TOTPModel>(ctx.storage, totpKey(userId))
			}

			const saveTOTPData = async (userId: string, data: TOTPModel): Promise<void> => {
				await Storage.set(ctx.storage, totpKey(userId), data)
			}

			const generateBackupCodes = (count: number): string[] => {
				const codes: string[] = []
				for (let i = 0; i < count; i++) {
					// Generate 8-character codes with format XXXX-XXXX
					const code = generateSecureToken().slice(0, 8).toUpperCase()
					codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
				}
				return codes
			}

			const createTOTPInstance = (secret: string, label: string): TOTP => {
				return new TOTP({
					issuer,
					label,
					algorithm,
					digits,
					period,
					secret: secret
				})
			}

			// --- SETUP FLOW ---

			routes.get("/register", async (c) => {
				// Show register form - user will enter email + verify token
				return ctx.forward(c, await config.register(c.request, "", "", []))
			})

			routes.post("/register", async (c) => {
				const formData = await c.formData()
				const email = formData.get("email")?.toString()
				const action = formData.get("action")?.toString()

				if (!email) {
					return ctx.forward(
						c,
						await config.register(c.request, "", "", [], "Email is required")
					)
				}

				if (action === "generate") {
					// Generate QR code for this email
					const secret = new Secret({ size: 20 })
					const label = config.generateLabel ? await config.generateLabel(email) : email
					const backupCodes = generateBackupCodes(backupCodesCount)

					// Create TOTP instance for QR code generation
					const totp = createTOTPInstance(secret.base32, label)
					const qrCodeUrl = totp.toString()

					// Store setup data temporarily (not enabled yet)
					const totpData: TOTPModel = {
						secret: secret.base32,
						enabled: false,
						backupCodes,
						createdAt: new Date().toISOString(),
						label
					}

					await saveTOTPData(email, totpData)

					return ctx.forward(
						c,
						await config.register(
							c.request,
							qrCodeUrl,
							secret.base32,
							backupCodes,
							undefined,
							email
						)
					)
				}

				// Verify token
				const token = formData.get("token")?.toString()

				if (!token) {
					return ctx.forward(
						c,
						await config.register(c.request, "", "", [], "Verification code is required")
					)
				}

				const totpData = await getTOTPData(email)

				if (!totpData) {
					return ctx.forward(
						c,
						await config.register(c.request, "", "", [], "TOTP setup session not found")
					)
				}

				// Create TOTP instance and verify setup token
				const totp = createTOTPInstance(totpData.secret, totpData.label || email)
				const delta = totp.validate({ token, window })

				if (delta !== null) {
					// Valid token - enable TOTP
					totpData.enabled = true
					await saveTOTPData(email, totpData)

					return ctx.success(c, {
						email,
						method: "totp"
					})
				}

				// Invalid token - show setup page again with error
				const qrCodeUrl = totp.toString()
				return ctx.forward(
					c,
					await config.register(
						c.request,
						qrCodeUrl,
						totpData.secret,
						totpData.backupCodes,
						"Invalid verification code. Please try again."
					)
				)
			})

			// --- AUTHENTICATION FLOW ---

			routes.get("/authorize", async (c) => {
				return ctx.forward(c, await config.authorize(c.request))
			})

			routes.post("/authorize", async (c) => {
				const formData = await c.formData()
				const email = formData.get("email")?.toString()
				const token = formData.get("token")?.toString()

				if (!email || !token) {
					return ctx.forward(
						c,
						await config.authorize(c.request, "Email and verification code are required")
					)
				}

				const totpData = await getTOTPData(email)
				if (!totpData || !totpData.enabled) {
					return ctx.forward(
						c,
						await config.authorize(c.request, "TOTP is not set up for this email")
					)
				}

				// Create TOTP instance and verify token
				const totp = createTOTPInstance(totpData.secret, totpData.label || email)
				const delta = totp.validate({ token, window })

				if (delta !== null) {
					// Valid TOTP token
					return ctx.success(c, {
						email,
						method: "totp"
					})
				}

				return ctx.forward(c, await config.authorize(c.request, "Invalid verification code"))
			})

			// --- RECOVERY FLOW ---

			routes.get("/recovery", async (c) => {
				return ctx.forward(c, await config.recovery(c.request))
			})

			routes.post("/recovery", async (c) => {
				const formData = await c.formData()
				const email = formData.get("email")?.toString()
				const code = formData.get("code")?.toString()?.toUpperCase()

				if (!email || !code) {
					return ctx.forward(
						c,
						await config.recovery(c.request, "Email and recovery code are required")
					)
				}

				const totpData = await getTOTPData(email)
				if (!totpData || !totpData.enabled) {
					return ctx.forward(
						c,
						await config.recovery(c.request, "TOTP is not set up for this email")
					)
				}

				// Check if recovery code exists and remove it (one-time use)
				const codeIndex = totpData.backupCodes.indexOf(code)
				if (codeIndex !== -1) {
					// Remove used code
					totpData.backupCodes.splice(codeIndex, 1)
					await saveTOTPData(email, totpData)

					return ctx.success(c, {
						email,
						method: "recovery"
					})
				}

				return ctx.forward(
					c,
					await config.recovery(c.request, "Invalid or already used recovery code")
				)
			})
		}
	}
}
