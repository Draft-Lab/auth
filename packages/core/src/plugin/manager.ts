/**
 * Plugin manager for DraftAuth
 */

import type { Router } from "@draftlab/auth-router"
import type { RouterContext } from "@draftlab/auth-router/types"
import type { StorageAdapter } from "../storage/storage"
import { type Plugin, type PluginContext, PluginError } from "./types"

export class PluginManager {
	private readonly plugins = new Map<string, Plugin>()
	private readonly storage: StorageAdapter

	constructor(storage: StorageAdapter) {
		this.storage = storage
	}

	/**
	 * Register a plugin
	 */
	register(plugin: Plugin): void {
		if (this.plugins.has(plugin.id)) {
			throw new PluginError(`Plugin already registered`, plugin.id)
		}

		this.plugins.set(plugin.id, plugin)
	}

	/**
	 * Register multiple plugins at once
	 */
	registerAll(plugins: Plugin[]): void {
		for (const plugin of plugins) {
			this.register(plugin)
		}
	}

	/**
	 * Get all registered plugins
	 */
	getAll(): Plugin[] {
		return Array.from(this.plugins.values())
	}

	/**
	 * Get plugin by id
	 */
	get(id: string): Plugin | undefined {
		return this.plugins.get(id)
	}

	/**
	 * Setup plugin routes on a router
	 */
	setupRoutes(router: Router): void {
		const registeredPaths = new Set<string>()

		for (const plugin of this.plugins.values()) {
			if (!plugin.routes) continue

			for (const route of plugin.routes) {
				// Prefix plugin routes with plugin id for namespacing
				const fullPath = `/${plugin.id}${route.path}`

				// Check for path conflicts
				if (registeredPaths.has(fullPath)) {
					throw new PluginError(`Route conflict: ${fullPath} already registered`, plugin.id)
				}
				registeredPaths.add(fullPath)

				// Create context
				const handler = async (ctx: RouterContext) => {
					const pluginCtx: PluginContext = {
						...ctx,
						storage: this.storage
					}
					return await route.handler(pluginCtx)
				}

				// Register route based on method
				switch (route.method) {
					case "GET":
						router.get(fullPath, handler)
						break
					case "POST":
						router.post(fullPath, handler)
						break
				}
			}
		}
	}
}
