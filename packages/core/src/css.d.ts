/**
 * TypeScript declaration for CSS module imports.
 * Allows importing CSS files as text strings.
 */
declare module "*.css" {
	const css: string
	export default css
}
