/**
 * TOTP authentication UI component
 * Provides complete interfaces for TOTP setup, verification, and recovery
 */

import type { ComponentChildren } from "preact"
import QRCode from "qrcode"
import type { TOTPProviderConfig } from "../provider/totp"
import { Layout, renderToHTML } from "./base"
import { FormAlert } from "./form"

/**
 * Strongly typed copy text configuration for TOTP UI
 */
interface TOTPUICopy {
	// Setup flow specific
	readonly setup_manual_entry: string
	readonly setup_backup_codes_title: string
	readonly setup_backup_codes_description: string

	// Action buttons and links
	readonly button_continue: string
	readonly link_use_recovery: string
	readonly link_back_to_totp: string

	// Input placeholders
	readonly input_token: string
	readonly input_recovery_code: string
}

const DEFAULT_COPY: TOTPUICopy = {
	// Setup flow specific
	setup_manual_entry: "Can't scan? Enter this code manually:",
	setup_backup_codes_title: "Save your backup codes",
	setup_backup_codes_description:
		"Store these backup codes in a safe place. You can use them to access your account if you lose your device.",

	// Action buttons and links
	button_continue: "Continue",
	link_use_recovery: "Use backup code instead",
	link_back_to_totp: "Back to authenticator code",

	// Input placeholders
	input_token: "000000",
	input_recovery_code: "XXXX-XXXX"
}

/**
 * Configuration options for TOTP UI
 */
interface TOTPUIOptions {
	/** Custom copy text overrides */
	readonly copy?: Partial<TOTPUICopy>
	/** QR code image size in pixels */
	readonly qrSize?: number
	/** Whether to show manual secret entry option */
	readonly showManualEntry?: boolean
}

/**
 * Creates a complete UI configuration for TOTP authentication
 */
export const TOTPUI = (options: TOTPUIOptions = {}): Omit<TOTPProviderConfig, "issuer"> => {
	const { qrSize = 200, showManualEntry = true } = options

	const copy = {
		...DEFAULT_COPY,
		...options.copy
	}

	/**
	 * Generates QR code as data URL using the qrcode library
	 */
	const generateQRCode = async (text: string): Promise<string> => {
		try {
			return await QRCode.toDataURL(text, {
				width: qrSize,
				margin: 1,
				color: {
					dark: "#000000",
					light: "#FFFFFF"
				}
			})
		} catch (error) {
			console.error("QR Code generation failed:", error)
			return ""
		}
	}

	/**
	 * Renders the setup form with QR code and backup codes
	 */
	const renderRegister = async (
		qrCodeUrl: string,
		secret: string,
		backupCodes: string[],
		error?: string,
		email?: string
	): Promise<ComponentChildren> => {
		if (!qrCodeUrl) {
			// Show initial form to enter email
			return (
				<Layout>
					<form data-component="form" method="post" action="./register">
						<FormAlert message={error} />

						<input
							type="email"
							name="email"
							placeholder="Email"
							autoComplete="email"
							data-component="input"
							required
						/>

						<input type="hidden" name="action" value="generate" />
						<button type="submit" data-component="button">
							Generate QR Code
						</button>

						<div data-component="form-footer">
							<span>
								Already have TOTP?{" "}
								<a href="./authorize" data-component="link">
									Login
								</a>
							</span>
						</div>
					</form>
				</Layout>
			)
		}

		const qrCodeDataUrl = await generateQRCode(qrCodeUrl)

		return (
			<Layout>
				<form data-component="form" method="post" action="./register">
					<FormAlert message={error} />

					{/* Hidden field to remember the email */}
					{email && <input type="hidden" name="email" value={email} />}

					{/* QR Code Section */}
					{qrCodeDataUrl && (
						<img
							src={qrCodeDataUrl}
							alt="TOTP QR Code"
							width={qrSize}
							height={qrSize}
							style={{ display: "block", margin: "0 auto" }}
						/>
					)}

					{showManualEntry && (
						<div>
							<p data-component="description">{copy.setup_manual_entry}</p>
							<code style={{ display: "block", textAlign: "center", margin: "8px 0" }}>
								{secret}
							</code>
						</div>
					)}

					{/* Verification Input */}
					<input
						type="text"
						name="token"
						placeholder={copy.input_token}
						pattern="[0-9]{6}"
						maxLength={6}
						minLength={6}
						autoComplete="one-time-code"
						data-component="input"
						required
					/>

					<button type="submit" data-component="button">
						{copy.button_continue}
					</button>

					{/* Backup Codes Section */}
					{backupCodes.length > 0 && (
						<div>
							<h3 style={{ textAlign: "center" }}>{copy.setup_backup_codes_title}</h3>
							<p data-component="description">{copy.setup_backup_codes_description}</p>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(2, 1fr)",
									gap: "8px",
									margin: "16px 0"
								}}
							>
								{backupCodes.map((code, index) => (
									<code data-component="button" key={`${code}-${index + Math.random()}`}>
										{code}
									</code>
								))}
							</div>
						</div>
					)}
				</form>
			</Layout>
		)
	}

	/**
	 * Renders the authorize form (main TOTP login page following passkey pattern)
	 */
	const renderAuthorize = (error?: string): ComponentChildren => (
		<Layout>
			<form data-component="form" method="post" action="./authorize">
				<FormAlert message={error} />

				<input
					type="email"
					name="email"
					placeholder="Email"
					autoComplete="email"
					data-component="input"
					required
				/>

				<input
					type="text"
					name="token"
					placeholder={copy.input_token}
					pattern="[0-9]{6}"
					maxLength={6}
					minLength={6}
					autoComplete="one-time-code"
					data-component="input"
					required
				/>

				<button type="submit" data-component="button">
					{copy.button_continue}
				</button>

				<div data-component="form-footer">
					<span>
						Don't have TOTP setup?{" "}
						<a href="./register" data-component="link">
							Register
						</a>
					</span>
					<a href="./recovery" data-component="link">
						{copy.link_use_recovery}
					</a>
				</div>
			</form>
		</Layout>
	)

	/**
	 * Renders the recovery form
	 */
	const renderRecovery = (error?: string): ComponentChildren => (
		<Layout>
			<form data-component="form" method="post" action="./recovery">
				<FormAlert message={error} />

				<input
					type="email"
					name="email"
					placeholder="Email"
					autoComplete="email"
					data-component="input"
					required
				/>

				<input
					type="text"
					name="code"
					placeholder={copy.input_recovery_code}
					pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
					maxLength={9}
					autoComplete="off"
					data-component="input"
					required
				/>

				<button type="submit" data-component="button">
					{copy.button_continue}
				</button>

				<div data-component="form-footer">
					<a href="./authorize" data-component="link">
						{copy.link_back_to_totp}
					</a>
				</div>
			</form>
		</Layout>
	)

	return {
		authorize: async (_req, error) => {
			const jsx = renderAuthorize(error)
			return new Response(renderToHTML(jsx), {
				headers: { "Content-Type": "text/html" }
			})
		},

		register: async (_req, qrCodeUrl, secret, backupCodes, error, email) => {
			const jsx = await renderRegister(qrCodeUrl, secret, backupCodes, error, email)
			return new Response(renderToHTML(jsx), {
				headers: { "Content-Type": "text/html" }
			})
		},

		recovery: async (_req, error) => {
			const jsx = renderRecovery(error)
			return new Response(renderToHTML(jsx), {
				headers: { "Content-Type": "text/html" }
			})
		}
	}
}
