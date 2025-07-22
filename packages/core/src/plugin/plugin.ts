/**
 * Plugin system for DraftAuth
 */

import type { Plugin, PluginRouteHandler } from "./types"

/**
 * Plugin builder interface
 */
export interface PluginBuilder {
	/** Add GET route */
	get(path: string, handler: PluginRouteHandler): PluginBuilder
	/** Add POST route */
	post(path: string, handler: PluginRouteHandler): PluginBuilder
	/** Build the plugin */
	build(): Plugin
}
