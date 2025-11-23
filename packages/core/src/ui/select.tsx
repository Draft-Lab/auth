/**
 * Provider selection UI component
 */

import type { ComponentChildren } from "preact"
import type { Theme } from "../themes/theme"
import { Layout, renderToHTML } from "./base"
import {
	ICON_APPLE,
	ICON_DISCORD,
	ICON_EMAIL,
	ICON_FACEBOOK,
	ICON_GITHUB,
	ICON_GITLAB,
	ICON_GOOGLE,
	ICON_LINKEDIN,
	ICON_MICROSOFT,
	ICON_REDDIT,
	ICON_SLACK,
	ICON_SPOTIFY,
	ICON_TWITCH
} from "./icon"

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
	apple: ICON_APPLE,
	discord: ICON_DISCORD,
	email: ICON_EMAIL,
	facebook: ICON_FACEBOOK,
	github: ICON_GITHUB,
	gitlab: ICON_GITLAB,
	google: ICON_GOOGLE,
	linkedin: ICON_LINKEDIN,
	magiclink: ICON_EMAIL,
	microsoft: ICON_MICROSOFT,
	password: ICON_EMAIL,
	reddit: ICON_REDDIT,
	slack: ICON_SLACK,
	spotify: ICON_SPOTIFY,
	twitch: ICON_TWITCH
}

/**
 * Default display names for provider types
 */
const DEFAULT_DISPLAYS: Record<string, string> = {
	apple: "Apple",
	code: "Code",
	discord: "Discord",
	facebook: "Facebook",
	github: "GitHub",
	gitlab: "GitLab",
	google: "Google",
	linkedin: "LinkedIn",
	microsoft: "Microsoft",
	passkey: "Passkey",
	password: "Password",
	reddit: "Reddit",
	slack: "Slack",
	spotify: "Spotify",
	twitch: "Twitch"
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
