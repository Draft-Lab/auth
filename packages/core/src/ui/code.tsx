/**
 * UI component for PIN code authentication flow
 * Provides a complete interface for collecting user claims and verifying PIN codes
 */

import type { ComponentChildren } from "preact"
import type {
	CodeProviderError,
	CodeProviderOptions,
	CodeProviderState
} from "../provider/code"
import { Layout, renderToHTML } from "./base"

/**
 * Default text copy for the PIN code authentication UI
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
} as const

/**
 * Type for customizable UI copy text
 */
export interface CodeUICopy {
	readonly email_placeholder: string
	readonly email_invalid: string
	readonly button_continue: string
	readonly code_info: string
	readonly code_placeholder: string
	readonly code_invalid: string
	readonly code_sent: string
	readonly code_resent: string
	readonly code_didnt_get: string
	readonly code_resend: string
}

/**
 * Input mode for the contact field
 */
export type CodeUIMode = "email" | "phone"

/**
 * Configuration options for the CodeUI component
 */
export interface CodeUIOptions extends Pick<CodeProviderOptions, "sendCode"> {
	/**
	 * Input mode determining the type of contact information to collect
	 * @default "email"
	 */
	readonly mode?: CodeUIMode
	/**
	 * Custom text copy for UI labels, messages, and errors
	 */
	readonly copy?: Partial<CodeUICopy>
}

/**
 * FormAlert component for displaying messages
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
	autoFocus,
	...props
}: {
	readonly type: "email" | "tel" | "text"
	readonly name: string
	readonly placeholder: string
	readonly value?: string
	readonly required?: boolean
	readonly autoComplete?: string
	readonly autoFocus?: boolean
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

/**
 * Gets the appropriate error message for display
 */
const getErrorMessage = (
	error: CodeProviderError | undefined,
	copy: CodeUICopy
): string | undefined => {
	if (!error?.type) return undefined

	switch (error.type) {
		case "invalid_code":
			return copy.code_invalid
		case "invalid_claim":
			return copy.email_invalid
	}
}

/**
 * Gets the appropriate success message for display
 */
const getSuccessMessage = (
	state: CodeProviderState,
	copy: CodeUICopy
): { message: string; contact: string } | undefined => {
	if (state.type === "start" || !state.claims) return undefined

	const contact = (state.claims.email as string) || (state.claims.phone as string) || ""
	const prefix = state.resend ? copy.code_resent : copy.code_sent

	return {
		message: `${prefix}${contact}`,
		contact
	}
}

/**
 * Creates a complete UI configuration for PIN code authentication
 */
export const CodeUI = (options: CodeUIOptions): CodeProviderOptions => {
	const copy: CodeUICopy = {
		...DEFAULT_COPY,
		...options.copy
	}

	const mode = options.mode || "email"

	/**
	 * Renders the start form for collecting contact information
	 */
	const renderStart = (
		form: FormData | undefined,
		error: CodeProviderError | undefined,
		state?: CodeProviderState
	): ComponentChildren => {
		const success = getSuccessMessage(state || { type: "start" }, copy)

		return (
			<Layout>
				<form data-component="form" method="post">
					{success ? (
						<FormAlert message={success.message} color="success" />
					) : (
						<FormAlert message={getErrorMessage(error, copy)} />
					)}

					<Input
						type={mode === "email" ? "email" : "tel"}
						name={mode}
						placeholder={copy.email_placeholder}
						value={form?.get(mode)?.toString() || ""}
						autoComplete={mode}
						required
					/>

					<input type="hidden" name="action" value="request" />
					<Button type="submit">{copy.button_continue}</Button>

					<p
						style={{
							fontSize: "0.875rem",
							color: "var(--color-high)",
							textAlign: "center",
							margin: "1rem 0 0 0"
						}}
					>
						{copy.code_info}
					</p>
				</form>
			</Layout>
		)
	}

	/**
	 * Renders the code verification form
	 */
	const renderCode = (
		_form: FormData | undefined,
		error: CodeProviderError | undefined,
		state: CodeProviderState
	): ComponentChildren => {
		const success = getSuccessMessage(state, copy)
		const contact = state.type === "code" ? (state.claims?.[mode] as string) || "" : ""

		return (
			<Layout>
				<form data-component="form" method="post">
					{success ? (
						<FormAlert message={success.message} color="success" />
					) : (
						<FormAlert message={getErrorMessage(error, copy)} />
					)}

					<input name="action" type="hidden" value="verify" />

					<Input
						type="text"
						name="code"
						placeholder={copy.code_placeholder}
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
					<input name="action" type="hidden" value="resend" />
					<input name={mode} type="hidden" value={contact} />

					<div data-component="form-footer">
						<span style={{ fontSize: "0.875rem" }}>{copy.code_didnt_get}</span>
						<Button type="submit" data-component="link">
							{copy.code_resend}
						</Button>
					</div>
				</form>
			</Layout>
		)
	}

	return {
		sendCode: options.sendCode,

		/**
		 * Renders the appropriate UI based on current state
		 */
		request: async (
			_req: Request,
			state: CodeProviderState,
			form?: FormData,
			error?: CodeProviderError
		): Promise<Response> => {
			const html = renderToHTML(
				state.type === "start"
					? renderStart(form, error, state)
					: renderCode(form, error, state)
			)

			return new Response(html, {
				headers: { "Content-Type": "text/html" }
			})
		}
	}
}
