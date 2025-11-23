/**
 * Core plugin system types
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
 * Lifecycle hook context provided to plugin hooks.
 * Contains information about the current operation and access to isolated storage.
 */
export interface PluginHookContext {
	/** Unique identifier for the plugin */
	pluginId: string
	/** Raw request object */
	request: Request
	/** Current time for consistency across hook execution */
	now: Date
	/** Storage adapter for data persistence */
	storage: StorageAdapter
}

/**
 * Hook called when the issuer is being initialized.
 * Useful for plugins that need to set up initial state or validate configuration.
 * Should complete quickly - takes place during server startup.
 */
export type PluginInitHook = (context: PluginHookContext) => Promise<void>

/**
 * Hook called before an authorization request is processed.
 * Use for validation, rate limiting, or request enhancement.
 */
export type PluginAuthorizeHook = (
	context: PluginHookContext & {
		clientID: string
		provider?: string
		scopes?: string[]
	}
) => Promise<void>

/**
 * Hook called after successful authentication.
 * Use for logging, analytics, webhooks, or side effects.
 * Cannot modify the response - hooks run in parallel.
 */
export type PluginSuccessHook = (
	context: PluginHookContext & {
		clientID: string
		provider?: string
		subject: {
			type: string
			properties: Record<string, unknown>
		}
	}
) => Promise<void>

/**
 * Hook called when an authentication error occurs.
 * Use for error logging, custom error pages, or error transformation.
 */
export type PluginErrorHook = (
	context: PluginHookContext & {
		error: Error
		clientID?: string
		provider?: string
	}
) => Promise<void>

/**
 * Main plugin interface with lifecycle hooks and storage isolation
 */
export interface Plugin {
	/** Unique plugin identifier */
	readonly id: string
	/** Custom routes added by this plugin */
	readonly routes?: readonly PluginRoute[]
	/** Called once when the issuer initializes */
	readonly onInit?: PluginInitHook
	/** Called before authorization request is processed */
	readonly onAuthorize?: PluginAuthorizeHook
	/** Called after successful authentication */
	readonly onSuccess?: PluginSuccessHook
	/** Called when an error occurs during authentication */
	readonly onError?: PluginErrorHook
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
