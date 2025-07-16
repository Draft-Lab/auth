/**
 * Base layout component for DraftAuth UI
 */

import type { ComponentChildren, VNode } from "preact"
import { render } from "preact-render-to-string"
import { getTheme, type Theme } from "../themes/theme"

/**
 * Props for the Layout component
 */
export interface LayoutProps {
	children: ComponentChildren
	theme?: Theme
	title?: string
	size?: "small"
}

// Modern CSS styles for DraftAuth UI components
const css = `@import url("https://unpkg.com/tailwindcss@3.4.15/src/css/preflight.css");

:root {
  --color-background-dark: #0e0e11;
  --color-background-light: #ffffff;
  --color-primary-dark: #6772e5;
  --color-primary-light: #6772e5;

  --color-background-success-dark: oklch(0.3 0.04 172);
  --color-background-success-light: oklch(from var(--color-background-success-dark) 0.83 c h);
  --color-success-dark: oklch(from var(--color-background-success-dark) 0.92 c h);
  --color-success-light: oklch(from var(--color-background-success-dark) 0.25 c h);

  --color-background-error-dark: oklch(0.32 0.07 15);
  --color-background-error-light: oklch(from var(--color-background-error-dark) 0.92 c h);
  --color-error-dark: oklch(from var(--color-background-error-dark) 0.92 c h);
  --color-error-light: oklch(from var(--color-background-error-dark) 0.25 c h);

  --border-radius: 0;

  --color-background: var(--color-background-dark);
  --color-primary: var(--color-primary-dark);

  --color-background-success: var(--color-background-success-dark);
  --color-success: var(--color-success-dark);
  --color-background-error: var(--color-background-error-dark);
  --color-error: var(--color-error-dark);

  @media (prefers-color-scheme: light) {
    --color-background: var(--color-background-light);
    --color-primary: var(--color-primary-light);

    --color-background-success: var(--color-background-success-light);
    --color-success: var(--color-success-light);
    --color-background-error: var(--color-background-error-light);
    --color-error: var(--color-error-light);
  }

  --color-high: oklch(
    from var(--color-background) clamp(0, calc((l - 0.714) * -1000), 1) 0 0
  );
  --color-low: oklch(from var(--color-background) clamp(0, calc((l - 0.714) * 1000), 1) 0 0);
  --lightness-high: color-mix(
    in oklch,
    var(--color-high) 0%,
    oklch(var(--color-high) 0 0)
  );
  --lightness-low: color-mix(
    in oklch,
    var(--color-low) 0%,
    oklch(var(--color-low) 0 0)
  );
  --font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-scale: 1;

  --font-size-xs: calc(0.75rem * var(--font-scale));
  --font-size-sm: calc(0.875rem * var(--font-scale));
  --font-size-md: calc(1rem * var(--font-scale));
  --font-size-lg: calc(1.125rem * var(--font-scale));
  --font-size-xl: calc(1.25rem * var(--font-scale));
  --font-size-2xl: calc(1.5rem * var(--font-scale));
}

[data-component="root"] {
  font-family: var(--font-family);
  background-color: var(--color-background);
  padding: 1rem;
  color: white;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  user-select: none;
  color: var(--color-high);
}

[data-component="center"] {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

[data-component="center"][data-size="small"] {
  width: 300px;
}

[data-component="link"] {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  font-weight: 600;
}

[data-component="label"] {
  display: flex;
  gap: 0.75rem;
  flex-direction: column;
  font-size: var(--font-size-xs);
}

[data-component="logo"] {
  margin: 0 auto;
  height: 2.5rem;
  width: auto;
  display: none;
}

[data-component="logo"][data-mode="light"] {
  display: none;
}

[data-component="logo"][data-mode="dark"] {
  display: block;
}

@media (prefers-color-scheme: light) {
  [data-component="logo"][data-mode="light"] {
    display: block;
  }
  
  [data-component="logo"][data-mode="dark"] {
    display: none;
  }
}

@media (prefers-color-scheme: dark) {
  [data-component="logo"][data-mode="dark"] {
    display: block;
  }
}

[data-component="logo-default"] {
  margin: 0 auto;
  height: 2.5rem;
  width: auto;
}

@media (prefers-color-scheme: light) {
  [data-component="logo-default"] {
    color: var(--color-high);
  }
}

@media (prefers-color-scheme: dark) {
  [data-component="logo-default"] {
    color: var(--color-high);
  }
}

[data-component="input"] {
  width: 100%;
  height: 2.5rem;
  padding: 0 1rem;
  border: 1px solid transparent;
  --background: oklch(
    from var(--color-background) calc(l + (-0.06 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.03)) c h
  );
  background: var(--background);
  border-color: oklch(
    from var(--color-background)
      calc(clamp(0.22, l + (-0.12 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.06), 0.88)) c h
  );
  border-radius: calc(var(--border-radius) * 0.25rem);
  font-size: var(--font-size-sm);
  outline: none;
}

[data-component="input"]:focus {
  border-color: oklch(
    from var(--color-background)
      calc(clamp(0.3, l + (-0.2 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.1), 0.7)) c h
  );
}

[data-component="input"]:user-invalid:not(:focus) {
  border-color: oklch(0.4 0.09 7.91);
}

[data-component="button"] {
  height: 2.5rem;
  cursor: pointer;
  border: 0;
  font-weight: 500;
  font-size: var(--font-size-sm);
  border-radius: calc(var(--border-radius) * 0.25rem);
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: oklch(from var(--color-primary) clamp(0, calc((l - 0.714) * -1000), 1) 0 0);
}

[data-component="button"][data-color="ghost"] {
  background: transparent;
  color: var(--color-high);
  border: 1px solid
    oklch(
      from var(--color-background)
        calc(clamp(0.22, l + (-0.12 * clamp(0, calc((l - 0.714) * 1000), 1) + 0.06), 0.88)) c h
    );
}

[data-component="button"] [data-slot="icon"] {
  width: 16px;
  height: 16px;
}

[data-component="button"] [data-slot="icon"] svg {
  width: 100%;
  height: 100%;
}

[data-component="form"] {
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
}

[data-component="form-alert"] {
  height: 2.5rem;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  border-radius: calc(var(--border-radius) * 0.25rem);
  background: var(--color-background-error);
  color: var(--color-error);
  text-align: left;
  font-size: 0.75rem;
  gap: 0.5rem;
}

[data-component="form-alert"][data-color="success"] {
  background: var(--color-background-success);
  color: var(--color-success);
}

[data-component="form-alert"][data-color="success"] [data-slot="icon-success"] {
  display: block;
}

[data-component="form-alert"][data-color="success"] [data-slot="icon-danger"] {
  display: none;
}

[data-component="form-alert"]:has([data-slot="message"]:empty) {
  display: none;
}

[data-component="form-alert"] [data-slot="icon-success"],
[data-component="form-alert"] [data-slot="icon-danger"] {
  width: 1rem;
  height: 1rem;
}

[data-component="form-alert"] [data-slot="icon-success"] {
  display: none;
}

[data-component="form-footer"] {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  align-items: center;
  justify-content: center;
}

[data-component="form-footer"]:has(> :nth-child(2)) {
  justify-content: space-between;
}

[data-component="title"] {
  font-size: var(--font-size-2xl);
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--color-high);
  text-align: center;
}

[data-component="description"] {
  font-size: var(--font-size-sm);
  color: var(--color-high);
  margin: 0 0 1.5rem 0;
  text-align: center;
  opacity: 0.8;
}
`

/**
 * Base Layout component that provides the foundational structure for all auth UIs
 */
export const Layout = ({ children, theme, title, size }: LayoutProps) => {
	const currentTheme = theme || getTheme()

	/**
	 * Gets a theme value for a specific key and color mode.
	 */
	const getThemeValue = (
		key: "primary" | "background" | "logo",
		mode: "light" | "dark"
	): string | undefined => {
		if (!currentTheme?.[key]) {
			return
		}

		if (typeof currentTheme[key] === "string") {
			return currentTheme[key] as string
		}

		return (currentTheme[key] as Record<string, string>)[mode]
	}

	/**
	 * Calculates border radius value based on theme configuration.
	 */
	const getBorderRadius = (): string => {
		switch (currentTheme?.radius) {
			case "none":
				return "0"
			case "sm":
				return "1"
			case "md":
				return "1.25"
			case "lg":
				return "1.5"
			case "full":
				return "1000000000001"
			default:
				return "1"
		}
	}

	/**
	 * Checks if both light and dark logo variants are available.
	 */
	const hasCustomLogo = Boolean(
		getThemeValue("logo", "light") && getThemeValue("logo", "dark")
	)

	/**
	 * CSS custom properties for theming.
	 */
	const themeStyles = [
		`--color-background-light: ${getThemeValue("background", "light") || ""}`,
		`--color-background-dark: ${getThemeValue("background", "dark") || ""}`,
		`--color-primary-light: ${getThemeValue("primary", "light") || ""}`,
		`--color-primary-dark: ${getThemeValue("primary", "dark") || ""}`,
		`--font-family: ${currentTheme?.font?.family || ""}`,
		`--font-scale: ${currentTheme?.font?.scale || ""}`,
		`--border-radius: ${getBorderRadius()}`
	].join("; ")

	// Favicon handling
	const faviconHtml = currentTheme?.favicon
		? `<link href="${currentTheme.favicon}" rel="icon" />`
		: `
			<link href="https://openauth.js.org/favicon.ico" rel="icon" sizes="48x48" />
			<link href="https://openauth.js.org/favicon.svg" media="(prefers-color-scheme: light)" rel="icon" />
			<link href="https://openauth.js.org/favicon-dark.svg" media="(prefers-color-scheme: dark)" rel="icon" />
			<link href="https://openauth.js.org/favicon.svg" rel="shortcut icon" type="image/svg+xml" />
		  `

	// Logo section
	const logoHtml = hasCustomLogo
		? `
			<img
				alt="Logo Light"
				data-component="logo"
				data-mode="light"
				src="${getThemeValue("logo", "light") || ""}"
			/>
			<img
				alt="Logo Dark"
				data-component="logo"
				data-mode="dark"
				src="${getThemeValue("logo", "dark") || ""}"
			/>
		  `
		: `
			<svg
				aria-label="Draft Auth Logo"
				data-component="logo-default"
				fill="none"
				height="51"
				viewBox="0 0 51 51"
				width="51"
				xmlns="http://www.w3.org/2000/svg"
			>
				<title>Draft Auth Logo</title>
				<path
					d="M0 50.2303V0.12854H50.1017V50.2303H0ZM3.08002 11.8326H11.7041V3.20856H3.08002V11.8326ZM14.8526 11.8326H23.4766V3.20856H14.8526V11.8326ZM26.5566 11.8326H35.1807V3.20856H26.5566V11.8326ZM38.3292 11.8326H47.0217V3.20856H38.3292V11.8326ZM3.08002 23.6052H11.7041V14.9811H3.08002V23.6052ZM14.8526 23.6052H23.4766V14.9811H14.8526V23.6052ZM26.5566 23.6052H35.1807V14.9811H26.5566V23.6052ZM38.3292 23.6052H47.0217V14.9811H38.3292V23.6052ZM3.08002 35.3092H11.7041V26.6852H3.08002V35.3092ZM14.8526 35.3092H23.4766V26.6852H14.8526V35.3092ZM26.5566 35.3092H35.1807V26.6852H26.5566V35.3092ZM38.3292 35.3092H47.0217V26.6852H38.3292V35.3092ZM3.08002 47.1502H11.7041V38.3893H3.08002V47.1502ZM14.8526 47.1502H23.4766V38.3893H14.8526V47.1502ZM26.5566 47.1502H35.1807V38.3893H26.5566V47.1502ZM38.3292 47.1502H47.0217V38.3893H38.3292V47.1502Z"
					fill="currentColor"
				/>
			</svg>
		  `

	return (
		<html lang="en" style={themeStyles}>
			<head>
				<title>{title || currentTheme?.title || "Draft Auth"}</title>
				<meta charset="utf-8" />
				<meta content="width=device-width, initial-scale=1" name="viewport" />
				<div dangerouslySetInnerHTML={{ __html: faviconHtml }} />
				<style dangerouslySetInnerHTML={{ __html: css }} />
				{currentTheme?.css && <style dangerouslySetInnerHTML={{ __html: currentTheme.css }} />}
			</head>
			<body>
				<div data-component="root">
					<div data-component="center" data-size={size || ""}>
						<div dangerouslySetInnerHTML={{ __html: logoHtml }} />
						{children}
					</div>
				</div>
			</body>
		</html>
	)
}

/**
 * Helper function to render a Preact component to HTML string
 */
export const renderToHTML = (component: ComponentChildren): string => {
	if (!component) return ""
	return render(component as VNode)
}
