/**
 * Type-safe plugin system for DraftAuth
 */

import type { Plugin, PluginRouteHandler } from "./types"

/**
 * Plugin builder interface for fluent API
 */
export interface PluginBuilder {
	/** Add GET route */
	get(path: string, handler: PluginRouteHandler): PluginBuilder
	/** Add POST route */
	post(path: string, handler: PluginRouteHandler): PluginBuilder
	/** Build the plugin */
	build(): Plugin
}
