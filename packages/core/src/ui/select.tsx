/**
 * Provider selection UI component
 */

import type { ComponentChildren } from "preact"
import type { Theme } from "../themes/theme"
import { Layout, renderToHTML } from "./base"
import { ICON_GITHUB, ICON_GOOGLE } from "./icon"

/**
 * Provider configuration for the select UI
 */
export interface ProviderConfig {
	/** Whether to hide the provider from the select UI */
	hide?: boolean
	/** Custom display name for this provider */
	display?: string
}

/**
 * Props for the Select component
 */
export interface SelectProps {
	/** Provider-specific configurations */
	providers?: Record<string, ProviderConfig>
	/** Custom copy text overrides */
	copy?: {
		button_provider?: string
	}
	/** Global display name overrides for provider types */
	displays?: Record<string, string>
	/** Theme configuration */
	theme?: Theme
}

/**
 * Icon components for providers
 */
const PROVIDER_ICONS: Record<string, () => ComponentChildren> = {
	github: ICON_GITHUB,
	google: ICON_GOOGLE
}

/**
 * Default display names for provider types
 */
const DEFAULT_DISPLAYS: Record<string, string> = {
	github: "GitHub",
	google: "Google",
	code: "Code",
	passkey: "Passkey",
	password: "Password"
}

/**
 * Main provider selection component
 */
const ProviderSelect = ({
	providers,
	config = {},
	theme
}: {
	providers: Record<string, string>
	config: SelectProps
	theme?: Theme
}) => {
	const buttonText = config.copy?.button_provider || "Continue with"
	const displays = { ...DEFAULT_DISPLAYS, ...config.displays }

	const visibleProviders = Object.entries(providers).filter(
		([key]) => !config.providers?.[key]?.hide
	)

	return (
		<Layout theme={theme} title="Sign In">
			<div data-component="form">
				{visibleProviders.map(([key, type]) => {
					const displayName =
						config.providers?.[key]?.display ||
						displays[type] ||
						DEFAULT_DISPLAYS[type] ||
						type
					const IconComponent = PROVIDER_ICONS[key] || PROVIDER_ICONS[type]

					return (
						<a
							key={key}
							href={`./${key}/authorize`}
							data-component="button"
							data-color="ghost"
							aria-label={`${buttonText} ${displayName}`}
						>
							{IconComponent && (
								<i data-slot="icon">
									<IconComponent />
								</i>
							)}
							{buttonText} {displayName}
						</a>
					)
				})}
			</div>
		</Layout>
	)
}

/**
 * Creates a provider selection UI
 */
export const Select = (props: SelectProps = {}) => {
	return async (providers: Record<string, string>): Promise<Response> => {
		const html = renderToHTML(
			<ProviderSelect providers={providers} config={props} theme={props.theme} />
		)

		return new Response(html, {
			headers: { "Content-Type": "text/html" }
		})
	}
}
