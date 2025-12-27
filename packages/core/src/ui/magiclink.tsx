/**
 * UI component for Magic Link authentication flow
 * Provides a complete interface for collecting user claims and sending magic links
 */

import type { ComponentChildren } from "preact"
import type { MagicLinkConfig, MagicLinkError, MagicLinkState } from "../provider/magiclink"
import { run } from "../util"
import { Layout, renderToHTML } from "./base"
import { FormAlert } from "./form"

/**
 * Default text copy for the Magic Link authentication UI
 */
const DEFAULT_COPY = {
	/** Placeholder text for the email/contact input field */
	email_placeholder: "Email",
	/** Error message displayed when the entered email/contact is invalid */
	email_invalid: "Email address is not valid",
	/** Text for the primary action button */
	button_continue: "Send Magic Link",
	/** Informational text explaining that a magic link will be sent */
	link_info: "We'll send a secure link to your email.",
	/** Success message prefix when magic link is initially sent */
	link_sent: "Magic link sent to ",
	/** Success message prefix when magic link is resent */
	link_resent: "Magic link resent to ",
	/** Text asking if user didn't receive the magic link */
	link_didnt_get: "Didn't get the email?",
	/** Text for the resend magic link button */
	link_resend: "Resend Magic Link"
} as const

/**
 * Type for customizable UI copy text
 */
export interface MagicLinkUICopy {
	readonly email_placeholder: string
	readonly email_invalid: string
	readonly button_continue: string
	readonly link_info: string
	readonly link_sent: string
	readonly link_resent: string
	readonly link_didnt_get: string
	readonly link_resend: string
}

/**
 * Input mode for the contact field
 */
export type MagicLinkUIMode = "email" | "phone"

/**
 * Configuration options for the MagicLinkUI component
 */
export interface MagicLinkUIOptions<
	Claims extends Record<string, string> = Record<string, string>
> extends Pick<MagicLinkConfig<Claims>, "sendLink"> {
	/**
	 * Input mode determining the type of contact information to collect
	 * @default "email"
	 */
	readonly mode?: MagicLinkUIMode
	/**
	 * Custom text copy for UI labels, messages, and errors
	 */
	readonly copy?: Partial<MagicLinkUICopy>
}

/**
 * Gets the appropriate error message for display
 */
const getErrorMessage = (
	error: MagicLinkError | undefined,
	copy: MagicLinkUICopy
): string | undefined => {
	if (!error?.type) return undefined

	switch (error.type) {
		case "invalid_link":
			return "This magic link is invalid or expired"
		case "invalid_claim":
			return copy.email_invalid
	}
}

/**
 * Gets the appropriate success message for display
 */
const getSuccessMessage = (
	state: MagicLinkState,
	copy: MagicLinkUICopy,
	mode: MagicLinkUIMode
): { message: string; contact: string } | undefined => {
	if (state.type === "start" || !state.claims) return undefined

	const contact = (state.claims[mode] as string) || ""
	const prefix = state.resend ? copy.link_resent : copy.link_sent

	return {
		message: `${prefix}${contact}`,
		contact
	}
}

/**
 * Creates a complete UI configuration for Magic Link authentication
 */
export const MagicLinkUI = <Claims extends Record<string, string> = Record<string, string>>(
	options: MagicLinkUIOptions<Claims>
): MagicLinkConfig<Claims> => {
	const copy: MagicLinkUICopy = {
		...DEFAULT_COPY,
		...options.copy
	}

	const mode = options.mode || "email"

	/**
	 * Renders the start form for collecting contact information
	 */
	const renderStart = (
		form: FormData | undefined,
		error: MagicLinkError | undefined,
		state?: MagicLinkState
	): ComponentChildren => {
		const success = getSuccessMessage(state || { type: "start" }, copy, mode)

		return (
			<Layout>
				<form data-component="form" method="post">
					{run(() => {
						if (success) {
							return <FormAlert message={success.message} color="success" />
						}
						return <FormAlert message={getErrorMessage(error, copy)} />
					})}

					<input
						data-component="input"
						type={mode === "email" ? "email" : "tel"}
						name={mode}
						placeholder={copy.email_placeholder}
						value={form?.get(mode)?.toString() || ""}
						autoComplete={mode}
						required
					/>

					<input type="hidden" name="action" value="request" />
					<button data-component="button" type="submit">
						{copy.button_continue}
					</button>

					<p data-component="description">{copy.link_info}</p>
				</form>
			</Layout>
		)
	}

	/**
	 * Renders the "check your email" page after magic link is sent
	 */
	const renderSent = (
		_form: FormData | undefined,
		error: MagicLinkError | undefined,
		state: MagicLinkState
	): ComponentChildren => {
		const success = getSuccessMessage(state, copy, mode)
		const contact = state.type === "sent" ? (state.claims?.[mode] as string) || "" : ""

		return (
			<Layout>
				<form data-component="form" method="post">
					<h2 data-component="title">Check your email</h2>

					{run(() => {
						if (success) {
							return <FormAlert message={success.message} color="success" />
						}
						return <FormAlert message={getErrorMessage(error, copy)} />
					})}

					<p data-component="description">Click the link in your email to sign in.</p>

					<input name="action" type="hidden" value="resend" />
					<input name={mode} type="hidden" value={contact} />

					<div data-component="form-footer">
						<span>
							{copy.link_didnt_get}{" "}
							<button type="submit" data-component="link">
								{copy.link_resend}
							</button>
						</span>
					</div>
				</form>
			</Layout>
		)
	}

	return {
		sendLink: options.sendLink,

		/**
		 * Renders the appropriate UI based on current state
		 */
		request: async (
			_req: Request,
			state: MagicLinkState,
			form?: FormData,
			error?: MagicLinkError
		): Promise<Response> => {
			const html = renderToHTML(
				state.type === "start"
					? renderStart(form, error, state)
					: renderSent(form, error, state)
			)

			return new Response(html, {
				headers: { "Content-Type": "text/html" }
			})
		}
	}
}
