/**
 * Plugin manager for DraftAuth
 * Handles plugin registration, execution, and lifecycle
 */

import type { Router } from "@draftlab/auth-router"
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
	 * Setup plugin routes on a router
	 */
	setupRoutes(router: Router): void {
		for (const plugin of this.plugins.values()) {
			if (!plugin.routes) continue

			for (const route of plugin.routes) {
				// Add plugin routes to router
				switch (route.method) {
					case "GET":
						router.get(route.path, async (ctx) => {
							const pluginCtx: PluginContext = {
								...ctx,
								storage: this.storage
							}
							return await route.handler(pluginCtx)
						})
						break
					case "POST":
						router.post(route.path, async (ctx) => {
							const pluginCtx: PluginContext = {
								...ctx,
								storage: this.storage
							}
							return await route.handler(pluginCtx)
						})
						break
				}
			}
		}
	}
}
