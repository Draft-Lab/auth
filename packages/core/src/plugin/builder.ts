import type { PluginBuilder } from "./plugin"
import type { Plugin, PluginRoute, PluginRouteHandler } from "./types"

/**
 * Create a new plugin
 */
export const plugin = (id: string): PluginBuilder => {
	const routes: PluginRoute[] = []

	const builder: PluginBuilder = {
		get(path: string, handler: PluginRouteHandler): PluginBuilder {
			routes.push({ method: "GET", path, handler })
			return builder
		},
		post(path: string, handler: PluginRouteHandler): PluginBuilder {
			routes.push({ method: "POST", path, handler })
			return builder
		},
		build(): Plugin {
			return {
				id,
				routes
			}
		}
	}

	return builder
}
