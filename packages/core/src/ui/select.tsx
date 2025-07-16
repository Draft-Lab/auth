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
	google: ICON_GOOGLE,
	code: () => (
		<svg
			width="20"
			height="20"
			viewBox="0 0 52 52"
			fill="currentColor"
			aria-label="Code authentication"
			role="img"
		>
			<path d="M8.55,36.91A6.55,6.55,0,1,1,2,43.45,6.54,6.54,0,0,1,8.55,36.91Zm17.45,0a6.55,6.55,0,1,1-6.55,6.54A6.55,6.55,0,0,1,26,36.91Zm17.45,0a6.55,6.55,0,1,1-6.54,6.54A6.54,6.54,0,0,1,43.45,36.91ZM8.55,19.45A6.55,6.55,0,1,1,2,26,6.55,6.55,0,0,1,8.55,19.45Zm17.45,0A6.55,6.55,0,1,1,19.45,26,6.56,6.56,0,0,1,26,19.45Zm17.45,0A6.55,6.55,0,1,1,36.91,26,6.55,6.55,0,0,1,43.45,19.45ZM8.55,2A6.55,6.55,0,1,1,2,8.55,6.54,6.54,0,0,1,8.55,2ZM26,2a6.55,6.55,0,1,1-6.55,6.55A6.55,6.55,0,0,1,26,2ZM43.45,2a6.55,6.55,0,1,1-6.54,6.55A6.55,6.55,0,0,1,43.45,2Z" />
		</svg>
	)
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
 * Individual provider button component
 */
const ProviderButton = ({
	providerKey,
	providerType,
	config,
	displays,
	buttonText
}: {
	providerKey: string
	providerType: string
	config?: ProviderConfig
	displays: Record<string, string>
	buttonText: string
}) => {
	const displayName =
		config?.display || displays[providerType] || DEFAULT_DISPLAYS[providerType] || providerType
	const IconComponent = PROVIDER_ICONS[providerKey] || PROVIDER_ICONS[providerType]

	return (
		<a
			href={`./${providerKey}/authorize`}
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
				{visibleProviders.map(([key, type]) => (
					<ProviderButton
						key={key}
						providerKey={key}
						providerType={type}
						config={config.providers?.[key]}
						displays={displays}
						buttonText={buttonText}
					/>
				))}
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
