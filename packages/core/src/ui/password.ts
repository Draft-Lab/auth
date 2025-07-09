/**
 * Pre-built UI component for password-based authentication flows.
 * Provides complete interfaces for login, registration, and password changes with email verification.
 */

import type {
	PasswordChangeError,
	PasswordConfig,
	PasswordLoginError,
	PasswordRegisterError
} from "../provider/password"
import { Layout } from "./base"
import { FormAlert } from "./form"

/**
 * Default text copy for all password authentication UI screens.
 * All text can be customized via the copy prop.
 */
const DEFAULT_COPY = {
	// Error messages
	error_email_taken: "There is already an account with this email.",
	error_invalid_code: "Code is incorrect.",
	error_invalid_email: "Email is not valid.",
	error_invalid_password: "Password is incorrect.",
	error_password_mismatch: "Passwords do not match.",
	error_validation_error: "Password does not meet requirements.",

	// Page titles and descriptions
	register_title: "Welcome to the app",
	register_description: "Sign in with your email",
	login_title: "Welcome to the app",
	login_description: "Sign in with your email",

	// Action buttons and links
	register: "Register",
	register_prompt: "Don't have an account?",
	login_prompt: "Already have an account?",
	login: "Login",
	change_prompt: "Forgot password?",
	code_resend: "Resend code",
	code_return: "Back to",

	// Input placeholders
	input_email: "Email",
	input_password: "Password",
	input_code: "Code",
	input_repeat: "Repeat password",

	// Generic action button
	button_continue: "Continue",

	// Internal
	logo: "A"
}

/**
 * Type for customizable UI copy text.
 */
type PasswordUICopy = typeof DEFAULT_COPY

/**
 * Configuration options for the PasswordUI component.
 */
export interface PasswordUIOptions
	extends Pick<PasswordConfig, "sendCode" | "validatePassword"> {
	/**
	 * Custom text copy for UI labels, messages, and errors.
	 */
	readonly copy?: Partial<PasswordUICopy>
}

/**
 * Creates a complete UI configuration for password-based authentication.
 */
export const PasswordUI = (options: PasswordUIOptions): PasswordConfig => {
	const copy = {
		...DEFAULT_COPY,
		...options.copy
	}

	/**
	 * Gets the appropriate error message for display.
	 */
	const getErrorMessage = (
		error: PasswordLoginError | PasswordRegisterError | PasswordChangeError | undefined
	): string | undefined => {
		if (!error?.type) {
			return
		}

		if (error.type === "validation_error" && "message" in error && error.message) {
			return error.message
		}

		return copy[`error_${error.type}` as keyof typeof copy]
	}

	return {
		validatePassword: options.validatePassword,
		sendCode: options.sendCode,

		/**
		 * Renders the login form with email and password inputs.
		 */
		login: async (_req, form, error): Promise<Response> => {
			const formContent = `
				<form data-component="form" method="post">
					${FormAlert({ message: getErrorMessage(error) })}

					<input
						autocomplete="email"
						data-component="input"
						value="${form?.get("email")?.toString() || ""}"
						name="email"
						placeholder="${copy.input_email}"
						required
						type="email"
					/>

					<input
						autocomplete="current-password"
						data-component="input"
						name="password"
						placeholder="${copy.input_password}"
						required
						type="password"
					/>

					<button data-component="button" type="submit">
						${copy.button_continue}
					</button>

					<div data-component="form-footer">
						<span>
							${copy.register_prompt} 
							<a data-component="link" href="./register">
								${copy.register}
							</a>
						</span>
						<a data-component="link" href="./change">
							${copy.change_prompt}
						</a>
					</div>
				</form>
			`

			const html = Layout({ children: formContent })

			return new Response(html, {
				status: error ? 401 : 200,
				headers: { "Content-Type": "text/html" }
			})
		},

		/**
		 * Renders the registration form with email verification flow.
		 */
		register: async (_req, state, form, error): Promise<Response> => {
			const emailError = ["invalid_email", "email_taken"].includes(error?.type || "")
			const passwordError = [
				"invalid_password",
				"password_mismatch",
				"validation_error"
			].includes(error?.type || "")

			let formContent = ""

			if (state.type === "start") {
				formContent = `
					<form data-component="form" method="post">
						${FormAlert({ message: getErrorMessage(error) })}
						
						<input name="action" type="hidden" value="register" />

						<input
							autocomplete="email"
							data-component="input"
							value="${emailError ? "" : form?.get("email")?.toString() || ""}"
							name="email"
							placeholder="${copy.input_email}"
							required
							type="email"
						/>

						<input
							autocomplete="new-password"
							data-component="input"
							value="${passwordError ? "" : form?.get("password")?.toString() || ""}"
							name="password"
							placeholder="${copy.input_password}"
							required
							type="password"
						/>

						<input
							autocomplete="new-password"
							data-component="input"
							name="repeat"
							placeholder="${copy.input_repeat}"
							required
							type="password"
						/>

						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>

						<div data-component="form-footer">
							<span>
								${copy.login_prompt} 
								<a data-component="link" href="./authorize">
									${copy.login}
								</a>
							</span>
						</div>
					</form>
				`
			} else if (state.type === "code") {
				formContent = `
					<form data-component="form" method="post">
						${FormAlert({ message: getErrorMessage(error) })}
						
						<input name="action" type="hidden" value="verify" />

						<input
							aria-label="6-digit verification code"
							autocomplete="one-time-code"
							data-component="input"
							inputmode="numeric"
							maxlength="6"
							minlength="6"
							name="code"
							pattern="[0-9]{6}"
							placeholder="${copy.input_code}"
							required
							type="text"
						/>

						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>
					</form>
				`
			}

			const html = Layout({ children: formContent })

			return new Response(html, {
				headers: { "Content-Type": "text/html" }
			})
		},

		/**
		 * Renders the password change form with email verification.
		 */
		change: async (_req, state, form, error): Promise<Response> => {
			const passwordError = [
				"invalid_password",
				"password_mismatch",
				"validation_error"
			].includes(error?.type || "")

			let formContent = ""
			let additionalForms = ""

			if (state.type === "start") {
				formContent = `
					<form data-component="form" method="post">
						${FormAlert({ message: getErrorMessage(error) })}
						
						<input name="action" type="hidden" value="code" />

						<input
							autocomplete="email"
							data-component="input"
							value="${form?.get("email")?.toString() || ""}"
							name="email"
							placeholder="${copy.input_email}"
							required
							type="email"
						/>

						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>
					</form>
				`
			} else if (state.type === "code") {
				formContent = `
					<form data-component="form" method="post">
						${FormAlert({ message: getErrorMessage(error) })}
						
						<input name="action" type="hidden" value="verify" />

						<input
							aria-label="6-digit verification code"
							autocomplete="one-time-code"
							data-component="input"
							inputmode="numeric"
							maxlength="6"
							minlength="6"
							name="code"
							pattern="[0-9]{6}"
							placeholder="${copy.input_code}"
							required
							type="text"
						/>

						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>
					</form>
				`

				additionalForms = `
					<form method="post">
						<input name="action" type="hidden" value="code" />
						<input name="email" type="hidden" value="${state.email}" />

						<div data-component="form-footer">
							<span>
								${copy.code_return} 
								<a data-component="link" href="./authorize">
									${copy.login.toLowerCase()}
								</a>
							</span>
							<button data-component="link" type="submit">
								${copy.code_resend}
							</button>
						</div>
					</form>
				`
			} else if (state.type === "update") {
				formContent = `
					<form data-component="form" method="post">
						${FormAlert({ message: getErrorMessage(error) })}
						
						<input name="action" type="hidden" value="update" />

						<input
							autocomplete="new-password"
							data-component="input"
							value="${passwordError ? "" : form?.get("password")?.toString() || ""}"
							name="password"
							placeholder="${copy.input_password}"
							required
							type="password"
						/>

						<input
							autocomplete="new-password"
							data-component="input"
							value="${passwordError ? "" : form?.get("repeat")?.toString() || ""}"
							name="repeat"
							placeholder="${copy.input_repeat}"
							required
							type="password"
						/>

						<button data-component="button" type="submit">
							${copy.button_continue}
						</button>
					</form>
				`
			}

			const html = Layout({ children: formContent + additionalForms })

			return new Response(html, {
				status: error ? 400 : 200,
				headers: { "Content-Type": "text/html" }
			})
		}
	}
}
