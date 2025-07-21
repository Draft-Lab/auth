/**
 * Core plugin system types for DraftAuth
 */

import type { RouterContext } from "@draftlab/auth-router/types"
import type { StorageAdapter } from "../storage/storage"

export interface PluginContext extends RouterContext {
	storage: StorageAdapter
}

/**
 * Plugin route handler function
 */
export type PluginRouteHandler = (context: PluginContext) => Promise<Response>

/**
 * Plugin route definition
 */
export interface PluginRoute {
	/** Route path (e.g., "/admin", "/stats") */
	readonly path: string
	/** HTTP method */
	readonly method: "GET" | "POST"
	/** Route handler function */
	readonly handler: PluginRouteHandler
}

/**
 * Main plugin interface
 */
export interface Plugin {
	/** Unique plugin identifier */
	readonly id: string
	/** Custom routes added by this plugin */
	readonly routes?: readonly PluginRoute[]
}

/**
 * Plugin error types
 */
export class PluginError extends Error {
	constructor(message: string, pluginId: string) {
		super(`[Plugin: ${pluginId}] ${message}`)
		this.name = "PluginError"
	}
}
