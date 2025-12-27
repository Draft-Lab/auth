/**
 * Password authentication UI component
 * Provides complete interfaces for login, registration, and password changes with email verification
 */

import type { ComponentChildren } from "preact"
import type {
	PasswordChangeError,
	PasswordConfig,
	PasswordLoginError,
	PasswordRegisterError
} from "../provider/password"
import { run } from "../util"
import { Layout, renderToHTML } from "./base"
import { FormAlert } from "./form"

/**
 * Strongly typed copy text configuration for password UI
 */
interface PasswordUICopy {
	// Error messages
	readonly error_email_taken: string
	readonly error_invalid_code: string
	readonly error_invalid_email: string
	readonly error_invalid_password: string
	readonly error_password_mismatch: string

	// Action buttons and links
	readonly register: string
	readonly register_prompt: string
	readonly login_prompt: string
	readonly login: string
	readonly change_prompt: string
	readonly code_resend: string
	readonly code_return: string

	// Input placeholders
	readonly input_email: string
	readonly input_password: string
	readonly input_code: string
	readonly input_repeat: string

	// Generic action button
	readonly button_continue: string

	// Internal
	readonly logo: string
}

/**
 * Default copy text for password authentication UI
 */
const DEFAULT_COPY: PasswordUICopy = {
	// Error messages
	error_email_taken: "There is already an account with this email.",
	error_invalid_code: "Code is incorrect.",
	error_invalid_email: "Email is not valid.",
	error_invalid_password: "Password is incorrect.",
	error_password_mismatch: "Passwords do not match.",

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
 * Configuration options for the PasswordUI component
 */
export interface PasswordUIOptions
	extends Pick<PasswordConfig, "sendCode" | "validatePassword"> {
	/**
	 * Custom text copy for UI labels, messages, and errors
	 */
	readonly copy?: Partial<PasswordUICopy>
}

/**
 * Props for password authentication state
 */
interface PasswordAuthState {
	readonly type: "start" | "code" | "update"
	readonly email?: string
}

/**
 * Union type for all possible password errors
 */
type PasswordError = PasswordLoginError | PasswordRegisterError | PasswordChangeError

/**
 * Creates a complete UI configuration for password-based authentication
 */
export const PasswordUI = (options: PasswordUIOptions): PasswordConfig => {
	const copy: PasswordUICopy = {
		...DEFAULT_COPY,
		...options.copy
	}

	/**
	 * Gets the appropriate error message for display
	 */
	const getErrorMessage = (error: PasswordError | undefined): string | undefined => {
		if (!error?.type) return undefined

		if (error.type === "validation_error" && "message" in error && error.message) {
			return error.message
		}

		const errorKey = `error_${error.type}` as keyof PasswordUICopy
		return copy[errorKey]
	}

	/**
	 * Renders the login form with email and password inputs
	 */
	const renderLogin = (
		form: FormData | undefined,
		error: PasswordLoginError | undefined
	): ComponentChildren => (
		<Layout>
			<form data-component="form" method="post">
				<FormAlert message={getErrorMessage(error)} />

				<input
					type="email"
					name="email"
					placeholder={copy.input_email}
					value={form?.get("email")?.toString() || ""}
					autoComplete="email"
					data-component="input"
					required
				/>

				<input
					type="password"
					name="password"
					placeholder={copy.input_password}
					autoComplete="current-password"
					data-component="input"
					required
				/>

				<button data-component="button" type="submit">
					{copy.button_continue}
				</button>

				<div data-component="form-footer">
					<span>
						{copy.register_prompt}{" "}
						<a data-component="link" href="./register">
							{copy.register}
						</a>
					</span>
					<a data-component="link" href="./change">
						{copy.change_prompt}
					</a>
				</div>
			</form>
		</Layout>
	)

	/**
	 * Renders the registration form based on current state
	 */
	const renderRegister = (
		state: PasswordAuthState,
		form: FormData | undefined,
		error: PasswordRegisterError | undefined
	): ComponentChildren => {
		const emailError = ["invalid_email", "email_taken"].includes(error?.type || "")
		const passwordError = [
			"invalid_password",
			"password_mismatch",
			"validation_error"
		].includes(error?.type || "")

		return (
			<Layout>
				{run(() => {
					if (state.type === "start") {
						return (
							<form data-component="form" method="post">
								<FormAlert message={getErrorMessage(error)} />

								<input name="action" type="hidden" value="register" />

								<input
									type="email"
									name="email"
									placeholder={copy.input_email}
									value={emailError ? "" : form?.get("email")?.toString() || ""}
									autoComplete="email"
									data-component="input"
									required
								/>

								<input
									type="password"
									name="password"
									placeholder={copy.input_password}
									value={passwordError ? "" : form?.get("password")?.toString() || ""}
									autoComplete="new-password"
									data-component="input"
									required
								/>

								<input
									type="password"
									name="repeat"
									placeholder={copy.input_repeat}
									autoComplete="new-password"
									data-component="input"
									required
								/>

								<button data-component="button" type="submit">
									{copy.button_continue}
								</button>

								<div data-component="form-footer">
									<span>
										{copy.login_prompt}{" "}
										<a data-component="link" href="./authorize">
											{copy.login}
										</a>
									</span>
								</div>
							</form>
						)
					}

					return (
						<>
							<form data-component="form" method="post">
								<FormAlert message={getErrorMessage(error)} />

								<input name="action" type="hidden" value="verify" />

								<input
									type="text"
									name="code"
									placeholder={copy.input_code}
									aria-label="6-digit verification code"
									autoComplete="one-time-code"
									data-component="input"
									inputMode="numeric"
									maxLength={6}
									minLength={6}
									pattern="[0-9]{6}"
									required
								/>

								<button data-component="button" type="submit">
									{copy.button_continue}
								</button>
							</form>

							<form method="post">
								<input name="action" type="hidden" value="register" />
								<input name="email" type="hidden" value={state.email} />
								<input name="password" type="hidden" value="" />
								<input name="repeat" type="hidden" value="" />

								<div data-component="form-footer">
									<span>
										{copy.code_return}{" "}
										<a data-component="link" href="./authorize">
											{copy.login}
										</a>
									</span>
									<button type="submit" data-component="link">
										{copy.code_resend}
									</button>
								</div>
							</form>
						</>
					)
				})}
			</Layout>
		)
	}

	/**
	 * Renders the password change form based on current state
	 */
	const renderChange = (
		state: PasswordAuthState,
		form: FormData | undefined,
		error: PasswordChangeError | undefined
	): ComponentChildren => {
		const passwordError = [
			"invalid_password",
			"password_mismatch",
			"validation_error"
		].includes(error?.type || "")

		return (
			<Layout>
				{run(() => {
					if (state.type === "start") {
						return (
							<form data-component="form" method="post">
								<FormAlert message={getErrorMessage(error)} />

								<input name="action" type="hidden" value="code" />

								<input
									type="email"
									name="email"
									placeholder={copy.input_email}
									value={form?.get("email")?.toString() || ""}
									autoComplete="email"
									data-component="input"
									required
								/>

								<button data-component="button" type="submit">
									{copy.button_continue}
								</button>

								<div data-component="form-footer">
									<span>
										{copy.code_return}{" "}
										<a data-component="link" href="./authorize">
											{copy.login}
										</a>
									</span>
								</div>
							</form>
						)
					}

					if (state.type === "code") {
						return (
							<>
								<form data-component="form" method="post">
									<FormAlert message={getErrorMessage(error)} />

									<input name="action" type="hidden" value="verify" />

									<input
										type="text"
										name="code"
										placeholder={copy.input_code}
										aria-label="6-digit verification code"
										autoComplete="one-time-code"
										inputMode="numeric"
										maxLength={6}
										minLength={6}
										data-component="input"
										pattern="[0-9]{6}"
										required
									/>

									<button data-component="button" type="submit">
										{copy.button_continue}
									</button>
								</form>

								<form method="post">
									<input name="action" type="hidden" value="code" />
									<input name="email" type="hidden" value={state.email} />

									<div data-component="form-footer">
										<span>
											{copy.code_return}{" "}
											<a data-component="link" href="./authorize">
												{copy.login}
											</a>
										</span>
										<button type="submit" data-component="link">
											{copy.code_resend}
										</button>
									</div>
								</form>
							</>
						)
					}

					return (
						<form data-component="form" method="post">
							<FormAlert message={getErrorMessage(error)} />

							<input name="action" type="hidden" value="update" />

							<input
								type="password"
								name="password"
								placeholder={copy.input_password}
								value={passwordError ? "" : form?.get("password")?.toString() || ""}
								autoComplete="new-password"
								data-component="input"
								required
							/>

							<input
								type="password"
								name="repeat"
								placeholder={copy.input_repeat}
								value={passwordError ? "" : form?.get("repeat")?.toString() || ""}
								autoComplete="new-password"
								data-component="input"
								required
							/>

							<button data-component="button" type="submit">
								{copy.button_continue}
							</button>
						</form>
					)
				})}
			</Layout>
		)
	}

	return {
		validatePassword: options.validatePassword,
		sendCode: options.sendCode,

		/**
		 * Renders the login form with email and password inputs
		 */
		login: async (_req, form, error): Promise<Response> => {
			const html = renderToHTML(renderLogin(form, error))

			return new Response(html, {
				status: error ? 401 : 200,
				headers: { "Content-Type": "text/html" }
			})
		},

		/**
		 * Renders the registration form with email verification flow
		 */
		register: async (_req, state, form, error): Promise<Response> => {
			const html = renderToHTML(renderRegister(state, form, error))

			return new Response(html, {
				headers: { "Content-Type": "text/html" }
			})
		},

		/**
		 * Renders the password change form with email verification
		 */
		change: async (_req, state, form, error): Promise<Response> => {
			const html = renderToHTML(renderChange(state, form, error))

			return new Response(html, {
				status: error ? 400 : 200,
				headers: { "Content-Type": "text/html" }
			})
		}
	}
}
