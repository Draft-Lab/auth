import type { CookieOptions, RouterContext, VariableMap } from "./types"

export const getCookie = <TVariables extends VariableMap = VariableMap>(
	ctx: RouterContext<Record<string, string>, TVariables>,
	name: string
): string | undefined => {
	return ctx.cookie(name)
}

export const setCookie = <TVariables extends VariableMap = VariableMap>(
	ctx: RouterContext<Record<string, string>, TVariables>,
	name: string,
	value: string,
	options?: CookieOptions
): void => {
	ctx.setCookie(name, value, options)
}

export const deleteCookie = <TVariables extends VariableMap = VariableMap>(
	ctx: RouterContext<Record<string, string>, TVariables>,
	name: string,
	options?: Pick<CookieOptions, "domain" | "path">
): void => {
	ctx.deleteCookie(name, options)
}
