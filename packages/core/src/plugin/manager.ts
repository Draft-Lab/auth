/**
 * Plugin manager for DraftAuth
 *
 * Manages plugin lifecycle, routing, and isolated storage.
 * Provides hooks at key points in the OAuth flow for plugins to extend functionality.
 */

import type { Router } from "@draftlab/auth-router"
import type { RouterContext } from "@draftlab/auth-router/types"
import type { StorageAdapter } from "../storage/storage"
import { type Plugin, type PluginContext, PluginError, type PluginHookContext } from "./types"

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
	 * Initialize all plugins.
	 * Called once during issuer setup.
	 * Plugins can set up initial state or validate configuration.
	 *
	 * @throws PluginError if any plugin initialization fails
	 */
	async initialize(): Promise<void> {
		for (const plugin of this.plugins.values()) {
			if (!plugin.onInit) continue

			try {
				const context: PluginHookContext = {
					pluginId: plugin.id,
					request: new Request("http://internal/init"),
					now: new Date(),
					storage: this.storage
				}
				await plugin.onInit(context)
			} catch (error) {
				throw new PluginError(
					`Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
					plugin.id
				)
			}
		}
	}

	/**
	 * Execute authorize hooks for all plugins.
	 * Called before processing an authorization request.
	 * Can validate, rate limit, or enhance the request.
	 */
	async executeAuthorizeHooks(
		clientID: string,
		provider?: string,
		scopes?: string[]
	): Promise<void> {
		for (const plugin of this.plugins.values()) {
			if (!plugin.onAuthorize) continue

			try {
				const context: PluginHookContext & {
					clientID: string
					provider?: string
					scopes?: string[]
				} = {
					pluginId: plugin.id,
					request: new Request("http://internal/authorize"),
					now: new Date(),
					storage: this.storage,
					clientID,
					provider,
					scopes
				}

				await plugin.onAuthorize(context)
			} catch (error) {
				throw new PluginError(
					`Authorization hook failed: ${error instanceof Error ? error.message : String(error)}`,
					plugin.id
				)
			}
		}
	}

	/**
	 * Execute success hooks for all plugins.
	 * Called after successful authentication.
	 * Runs in parallel for better performance.
	 * Plugins cannot modify the response.
	 */
	async executeSuccessHooks(
		clientID: string,
		provider: string | undefined,
		subject: { type: string; properties: Record<string, unknown> }
	): Promise<void> {
		const hooks = Array.from(this.plugins.values())
			.filter((p) => p.onSuccess)
			.map(async (plugin) => {
				const context: PluginHookContext & {
					clientID: string
					provider?: string
					subject: { type: string; properties: Record<string, unknown> }
				} = {
					pluginId: plugin.id,
					request: new Request("http://internal/success"),
					now: new Date(),
					storage: this.storage,
					clientID,
					provider,
					subject
				}

				return plugin.onSuccess?.(context).catch((error) => {
					console.error(
						`[Plugin: ${plugin.id}] Success hook failed:`,
						error instanceof Error ? error.message : String(error)
					)
				})
			})

		// Execute all hooks in parallel, but don't throw on individual failures
		await Promise.all(hooks)
	}

	/**
	 * Execute error hooks for all plugins.
	 * Called when an authentication error occurs.
	 */
	async executeErrorHooks(error: Error, clientID?: string, provider?: string): Promise<void> {
		for (const plugin of this.plugins.values()) {
			if (!plugin.onError) continue

			try {
				const context: PluginHookContext & {
					error: Error
					clientID?: string
					provider?: string
				} = {
					pluginId: plugin.id,
					request: new Request("http://internal/error"),
					now: new Date(),
					storage: this.storage,
					error,
					clientID,
					provider
				}

				await plugin.onError(context)
			} catch (hookError) {
				console.error(
					`[Plugin: ${plugin.id}] Error hook failed:`,
					hookError instanceof Error ? hookError.message : String(hookError)
				)
			}
		}
	}

	/**
	 * Setup plugin routes on a router
	 */
	setupRoutes(router: Router): void {
		const registeredPaths = new Set<string>()

		for (const plugin of this.plugins.values()) {
			if (!plugin.routes) continue

			for (const route of plugin.routes) {
				// Prefix plugin routes with /plugin/{pluginId} for namespacing
				const fullPath = `/plugin/${plugin.id}${route.path}`

				// Check for path conflicts
				if (registeredPaths.has(fullPath)) {
					throw new PluginError(`Route conflict: ${fullPath} already registered`, plugin.id)
				}
				registeredPaths.add(fullPath)

				// Create context with isolated plugin storage
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
