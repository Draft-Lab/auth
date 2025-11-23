/**
 * Plugin system for DraftAuth
 */

import type {
	Plugin,
	PluginAuthorizeHook,
	PluginErrorHook,
	PluginInitHook,
	PluginRouteHandler,
	PluginSuccessHook
} from "./types"

/**
 * Plugin builder interface for creating plugins with a fluent API.
 *
 * The builder pattern allows for elegant plugin definition:
 * - Chain route definitions with lifecycle hooks
 * - Each method returns this for chaining
 * - Build finalizes the plugin definition
 *
 * @example
 * ```ts
 * const myPlugin = plugin("my-plugin")
 *   .onInit(async (ctx) => {
 *     console.log("Plugin initialized")
 *   })
 *   .post("/action", async (ctx) => {
 *     return ctx.json({ success: true })
 *   })
 *   .build()
 * ```
 */
export interface PluginBuilder {
	/** Register a GET route */
	get(path: string, handler: PluginRouteHandler): PluginBuilder

	/** Register a POST route */
	post(path: string, handler: PluginRouteHandler): PluginBuilder

	/** Register initialization hook (called once during issuer setup) */
	onInit(handler: PluginInitHook): PluginBuilder

	/** Register authorization hook (called before authorization request) */
	onAuthorize(handler: PluginAuthorizeHook): PluginBuilder

	/** Register success hook (called after successful authentication) */
	onSuccess(handler: PluginSuccessHook): PluginBuilder

	/** Register error hook (called when authentication fails) */
	onError(handler: PluginErrorHook): PluginBuilder

	/** Build the final plugin */
	build(): Plugin
}
