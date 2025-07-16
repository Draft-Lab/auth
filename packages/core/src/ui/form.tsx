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
 * Form alert component that displays error or success messages.
 */
export const FormAlert = ({
	message,
	color = "danger"
}: FormAlertProps): ComponentChildren => {
	return (
		<div data-component="form-alert" data-color={color}>
			<svg
				aria-hidden="true"
				data-slot="icon-success"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
				/>
			</svg>
			<svg
				aria-hidden="true"
				data-slot="icon-danger"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="1.5"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
				/>
			</svg>
			<span data-slot="message">{message}</span>
		</div>
	)
}
