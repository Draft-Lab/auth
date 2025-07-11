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
import { Layout, renderToHTML } from "./base"

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
	readonly error_validation_error: string

	// Page titles and descriptions
	readonly register_title: string
	readonly register_description: string
	readonly login_title: string
	readonly login_description: string

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
 * FormAlert component for displaying error messages
 */
const FormAlert = ({
	message,
	color = "danger"
}: {
	readonly message?: string
	readonly color?: "danger" | "success"
}): ComponentChildren => {
	if (!message) return null

	return (
		<div data-component="form-alert" data-color={color}>
			<i data-slot={color === "success" ? "icon-success" : "icon-danger"}>
				{color === "success" ? (
					<svg
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						aria-label="Success"
						role="img"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : (
					<svg
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						aria-label="Error"
						role="img"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z"
						/>
					</svg>
				)}
			</i>
			<span data-slot="message">{message}</span>
		</div>
	)
}

/**
 * Input component with consistent styling
 */
const Input = ({
	type,
	name,
	placeholder,
	value,
	required,
	autoComplete,
	...props
}: {
	readonly type: "email" | "password" | "text"
	readonly name: string
	readonly placeholder: string
	readonly value?: string
	readonly required?: boolean
	readonly autoComplete?: string
	readonly [key: string]: unknown
}): ComponentChildren => (
	<input
		type={type}
		name={name}
		placeholder={placeholder}
		value={value}
		required={required}
		autoComplete={autoComplete}
		data-component="input"
		{...props}
	/>
)

/**
 * Button component with consistent styling
 */
const Button = ({
	type = "submit",
	children,
	...props
}: {
	readonly type?: "button" | "submit"
	readonly children: ComponentChildren
	readonly [key: string]: unknown
}): ComponentChildren => (
	<button type={type} data-component="button" {...props}>
		{children}
	</button>
)

/**
 * Link component with consistent styling
 */
const Link = ({
	href,
	children,
	...props
}: {
	readonly href: string
	readonly children: ComponentChildren
	readonly [key: string]: unknown
}): ComponentChildren => (
	<a href={href} data-component="link" {...props}>
		{children}
	</a>
)

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

				<Input
					type="email"
					name="email"
					placeholder={copy.input_email}
					value={form?.get("email")?.toString() || ""}
					autoComplete="email"
					required
				/>

				<Input
					type="password"
					name="password"
					placeholder={copy.input_password}
					autoComplete="current-password"
					required
				/>

				<Button type="submit">{copy.button_continue}</Button>

				<div data-component="form-footer">
					<span>
						{copy.register_prompt} <Link href="./register">{copy.register}</Link>
					</span>
					<Link href="./change">{copy.change_prompt}</Link>
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
				{state.type === "start" ? (
					<form data-component="form" method="post">
						<FormAlert message={getErrorMessage(error)} />

						<input name="action" type="hidden" value="register" />

						<Input
							type="email"
							name="email"
							placeholder={copy.input_email}
							value={emailError ? "" : form?.get("email")?.toString() || ""}
							autoComplete="email"
							required
						/>

						<Input
							type="password"
							name="password"
							placeholder={copy.input_password}
							value={passwordError ? "" : form?.get("password")?.toString() || ""}
							autoComplete="new-password"
							required
						/>

						<Input
							type="password"
							name="repeat"
							placeholder={copy.input_repeat}
							autoComplete="new-password"
							required
						/>

						<Button type="submit">{copy.button_continue}</Button>

						<div data-component="form-footer">
							<span>
								{copy.login_prompt} <Link href="./authorize">{copy.login}</Link>
							</span>
						</div>
					</form>
				) : (
					<form data-component="form" method="post">
						<FormAlert message={getErrorMessage(error)} />

						<input name="action" type="hidden" value="verify" />

						<Input
							type="text"
							name="code"
							placeholder={copy.input_code}
							aria-label="6-digit verification code"
							autoComplete="one-time-code"
							inputMode="numeric"
							maxLength={6}
							minLength={6}
							pattern="[0-9]{6}"
							autoFocus
							required
						/>

						<Button type="submit">{copy.button_continue}</Button>
					</form>
				)}
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
				{state.type === "start" ? (
					<form data-component="form" method="post">
						<FormAlert message={getErrorMessage(error)} />

						<input name="action" type="hidden" value="code" />

						<Input
							type="email"
							name="email"
							placeholder={copy.input_email}
							value={form?.get("email")?.toString() || ""}
							autoComplete="email"
							required
						/>

						<Button type="submit">{copy.button_continue}</Button>
					</form>
				) : state.type === "code" ? (
					<>
						<form data-component="form" method="post">
							<FormAlert message={getErrorMessage(error)} />

							<input name="action" type="hidden" value="verify" />

							<Input
								type="text"
								name="code"
								placeholder={copy.input_code}
								aria-label="6-digit verification code"
								autoComplete="one-time-code"
								inputMode="numeric"
								maxLength={6}
								minLength={6}
								pattern="[0-9]{6}"
								autoFocus
								required
							/>

							<Button type="submit">{copy.button_continue}</Button>
						</form>

						<form method="post">
							<input name="action" type="hidden" value="code" />
							<input name="email" type="hidden" value={state.email} />

							<div data-component="form-footer">
								<span>
									{copy.code_return} <Link href="./authorize">{copy.login.toLowerCase()}</Link>
								</span>
								<Button type="submit" data-component="link">
									{copy.code_resend}
								</Button>
							</div>
						</form>
					</>
				) : (
					<form data-component="form" method="post">
						<FormAlert message={getErrorMessage(error)} />

						<input name="action" type="hidden" value="update" />

						<Input
							type="password"
							name="password"
							placeholder={copy.input_password}
							value={passwordError ? "" : form?.get("password")?.toString() || ""}
							autoComplete="new-password"
							required
						/>

						<Input
							type="password"
							name="repeat"
							placeholder={copy.input_repeat}
							value={passwordError ? "" : form?.get("repeat")?.toString() || ""}
							autoComplete="new-password"
							required
						/>

						<Button type="submit">{copy.button_continue}</Button>
					</form>
				)}
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
