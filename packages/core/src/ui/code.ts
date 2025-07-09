/**
 * Pre-built UI component for PIN code authentication flow.
 * Provides a complete interface for collecting user claims and verifying PIN codes.
 *
 * ## Quick Setup
 *
 * ```ts
 * import { CodeUI } from "@draftauth/core/ui/code"
 * import { CodeProvider } from "@draftauth/core/provider/code"
 *
 * export default issuer({
 *   providers: {
 *     email: CodeProvider(
 *       CodeUI({
 *         sendCode: async (claims, code) => {
 *           await emailService.send(claims.email, `Your code: ${code}`)
 *         }
 *       })
 *     )
 *   }
 * })
 * ```
 *
 * ## Customization
 *
 * ```ts
 * const customCodeUI = CodeUI({
 *   mode: "phone", // Switch to phone number input
 *   copy: {
 *     email_placeholder: "Enter your phone number",
 *     code_info: "We'll send a verification code via SMS",
 *     button_continue: "Send Code"
 *   },
 *   sendCode: async (claims, code) => {
 *     if (claims.phone) {
 *       await smsService.send(claims.phone, `Verification code: ${code}`)
 *     } else {
 *       return { type: "invalid_claim", key: "phone", value: "Phone number required" }
 *     }
 *   }
 * })
 * ```
 *
 * ## Features
 *
 * - **Email/Phone Mode**: Switch between email and phone number collection
 * - **Custom Copy**: Fully customizable text and messaging
 * - **Responsive Design**: Works on all device sizes
 * - **Accessibility**: ARIA labels, proper input types, and keyboard navigation
 * - **Error Handling**: Clear error states for invalid codes and claims
 * - **Resend Functionality**: Built-in code resend capability
 *
 * @packageDocumentation
 */

import { UnknownStateError } from "../error"
import type { CodeProviderError, CodeProviderOptions } from "../provider/code"
import { Layout } from "./base"
import { FormAlert } from "./form"

/**
 * Default text copy for the PIN code authentication UI.
 * All text can be customized via the copy prop.
 */
const DEFAULT_COPY = {
	/** Placeholder text for the email/contact input field */
	email_placeholder: "Email",
	/** Error message displayed when the entered email/contact is invalid */
	email_invalid: "Email address is not valid",
	/** Text for the primary action button */
	button_continue: "Continue",
	/** Informational text explaining that a PIN code will be sent */
	code_info: "We'll send a pin code to your email.",
	/** Placeholder text for the PIN code input field */
	code_placeholder: "Code",
	/** Error message displayed when the entered PIN code is incorrect */
	code_invalid: "Invalid code",
	/** Success message prefix when code is initially sent */
	code_sent: "Code sent to ",
	/** Success message prefix when code is resent */
	code_resent: "Code resent to ",
	/** Text asking if user didn't receive the code */
	code_didnt_get: "Didn't get code?",
	/** Text for the resend code button */
	code_resend: "Resend"
}

/**
 * Type for customizable UI copy text.
 * All properties are optional to allow partial customization.
 */
export type CodeUICopy = typeof DEFAULT_COPY

/**
 * Input mode for the contact field.
 * Determines the input type and validation behavior.
 */
export type CodeUIMode = "email" | "phone"

/**
 * Configuration options for the CodeUI component.
 */
export interface CodeUIOptions {
	/**
	 * Callback function for sending PIN codes to users.
	 * Should handle delivery via email, SMS, or other channels based on the claims.
	 *
	 * @param claims - User contact information (email, phone, etc.)
	 * @param code - The generated PIN code to send
	 * @returns Promise resolving to undefined on success, or error object on failure
	 *
	 * @example
	 * ```ts
	 * sendCode: async (claims, code) => {
	 *   if (claims.email) {
	 *     await emailService.send({
	 *       to: claims.email,
	 *       subject: 'Your verification code',
	 *       text: `Your PIN code is: ${code}`
	 *     })
	 *   } else if (claims.phone) {
	 *     await smsService.send(claims.phone, `PIN: ${code}`)
	 *   } else {
	 *     return {
	 *       type: "invalid_claim",
	 *       key: "contact",
	 *       value: "Email or phone required"
	 *     }
	 *   }
	 * }
	 * ```
	 */
	sendCode: (
		claims: Record<string, string>,
		code: string
	) => Promise<CodeProviderError | undefined>

	/**
	 * Custom text copy for UI labels and messages.
	 * Allows full customization of all displayed text.
	 *
	 * @example
	 * ```ts
	 * copy: {
	 *   email_placeholder: "Enter your email address",
	 *   code_info: "Check your email for a 6-digit verification code",
	 *   button_continue: "Verify",
	 *   code_invalid: "The code you entered is incorrect"
	 * }
	 * ```
	 */
	readonly copy?: Partial<CodeUICopy>

	/**
	 * Input mode determining the type of contact information to collect.
	 *
	 * @default "email"
	 *
	 * @example
	 * ```ts
	 * mode: "phone" // Collect phone numbers instead of emails
	 * ```
	 */
	readonly mode?: CodeUIMode
}

/**
 * Creates a complete UI configuration for PIN code authentication.
 * Provides pre-built forms for collecting user contact info and verifying PIN codes.
 *
 * @param options - Configuration options for the UI
 * @returns Complete CodeProvider configuration with UI handlers
 *
 * @example
 * ```ts
 * // Basic email-based PIN authentication
 * const emailCodeUI = CodeUI({
 *   sendCode: async (claims, code) => {
 *     await emailService.send(claims.email, `Code: ${code}`)
 *   }
 * })
 *
 * // Phone-based PIN authentication with custom copy
 * const phoneCodeUI = CodeUI({
 *   mode: "phone",
 *   copy: {
 *     email_placeholder: "Phone number",
 *     code_info: "We'll send a verification code via SMS",
 *     email_invalid: "Please enter a valid phone number"
 *   },
 *   sendCode: async (claims, code) => {
 *     await smsService.send(claims.phone, `Verification: ${code}`)
 *   }
 * })
 *
 * // Multi-mode authentication
 * const flexibleCodeUI = CodeUI({
 *   copy: {
 *     email_placeholder: "Email or phone number",
 *     code_info: "We'll send a code to your email or phone"
 *   },
 *   sendCode: async (claims, code) => {
 *     if (claims.email && claims.email.includes('@')) {
 *       await emailService.send(claims.email, `Code: ${code}`)
 *     } else if (claims.email) {
 *       // Treat as phone number if no @ symbol
 *       await smsService.send(claims.email, `Code: ${code}`)
 *     } else {
 *       return {
 *         type: "invalid_claim",
 *         key: "contact",
 *         value: "Email or phone required"
 *       }
 *     }
 *   }
 * })
 * ```
 */
export const CodeUI = (options: CodeUIOptions): CodeProviderOptions => {
	const copy = {
		...DEFAULT_COPY,
		...options.copy
	}

	const inputMode = options.mode ?? "email"

	/**
	 * Determines the appropriate input field attributes based on the selected mode.
	 */
	const getInputAttributes = () => {
		switch (inputMode) {
			case "email":
				return {
					type: "email",
					name: "email",
					inputmode: "email",
					autocomplete: "email"
				}
			case "phone":
				return {
					type: "tel",
					name: "phone",
					inputmode: "tel",
					autocomplete: "tel"
				}
		}
	}

	/**
	 * Gets the appropriate contact value from claims for display purposes.
	 */
	const getContactValue = (claims: Record<string, string>): string => {
		return claims.email || claims.phone || Object.values(claims)[0] || ""
	}

	return {
		sendCode: options.sendCode,
		length: 6,

		request: async (_req, state, _form, error): Promise<Response> => {
			// Render contact information collection form
			if (state.type === "start") {
				const inputAttrs = getInputAttributes()

				const formContent = `
					<form data-component="form" method="post">
						${error?.type === "invalid_claim" ? FormAlert({ message: copy.email_invalid }) : ""}
						
						<input name="action" type="hidden" value="request" />
						
						<input
							autofocus
							data-component="input"
							placeholder="${copy.email_placeholder}"
							required
							type="${inputAttrs.type}"
							name="${inputAttrs.name}"
							inputmode="${inputAttrs.inputmode}"
							autocomplete="${inputAttrs.autocomplete}"
						/>
						
						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>
					</form>
					
					<p data-component="form-footer">${copy.code_info}</p>
				`

				const html = Layout({ children: formContent })

				return new Response(html, {
					headers: { "Content-Type": "text/html" }
				})
			}

			// Render PIN code verification form
			if (state.type === "code") {
				const contactValue = getContactValue(state.claims)

				// Generate hidden inputs for claims
				const hiddenInputs = Object.entries(state.claims)
					.map(([key, value]) => `<input name="${key}" type="hidden" value="${value}" />`)
					.join("")

				const formContent = `
					<form data-component="form" method="post">
						${error?.type === "invalid_code" ? FormAlert({ message: copy.code_invalid }) : ""}
						
						${FormAlert({
							color: "success",
							message: (state.resend ? copy.code_resent : copy.code_sent) + contactValue
						})}
						
						<input name="action" type="hidden" value="verify" />
						
						<input
							aria-label="6-digit verification code"
							autocomplete="one-time-code"
							autofocus
							data-component="input"
							inputmode="numeric"
							maxlength="6"
							minlength="6"
							name="code"
							pattern="[0-9]{6}"
							placeholder="${copy.code_placeholder}"
							required
							type="text"
						/>
						
						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>
					</form>
					
					<form method="post">
						${hiddenInputs}
						
						<input name="action" type="hidden" value="resend" />
						
						<div data-component="form-footer">
							<span>
								${copy.code_didnt_get} 
								<button data-component="link" type="submit">
									${copy.code_resend}
								</button>
							</span>
						</div>
					</form>
				`

				const html = Layout({ children: formContent })

				return new Response(html, {
					headers: { "Content-Type": "text/html" }
				})
			}

			throw new UnknownStateError()
		}
	}
}
