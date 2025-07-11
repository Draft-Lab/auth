/**
 * Form alert component for displaying success and error messages.
 * Provides consistent styling and iconography for user feedback in authentication forms.
 */

import type { ComponentChildren } from "preact"

/**
 * Alert color variant determining the visual style and icon.
 */
export type FormAlertColor = "danger" | "success"

/**
 * Props for the FormAlert component.
 */
export interface FormAlertProps {
	/**
	 * The message text to display in the alert.
	 * If not provided, the alert will not render.
	 */
	readonly message?: string
	/**
	 * Visual style variant for the alert.
	 * @default "danger"
	 */
	readonly color?: FormAlertColor
}

/**
 * Success icon component showing a checkmark in a circle.
 * Used for positive feedback messages.
 */
const SuccessIcon = (): ComponentChildren => (
	<svg
		aria-hidden="true"
		data-slot="icon-success"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

/**
 * Danger icon component showing an exclamation mark in a circle.
 * Used for error and warning messages.
 */
const DangerIcon = (): ComponentChildren => (
	<svg
		aria-hidden="true"
		data-slot="icon-danger"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
)

/**
 * Form alert component that displays error or success messages.
 * Returns a Preact component or null if no message.
 */
export const FormAlert = ({
	message,
	color = "danger"
}: FormAlertProps): ComponentChildren => {
	if (!message) {
		return null
	}

	return (
		<div aria-live="polite" data-color={color} data-component="form-alert" role="alert">
			{color === "success" ? <SuccessIcon /> : <DangerIcon />}
			<span data-slot="message">{message}</span>
		</div>
	)
}
