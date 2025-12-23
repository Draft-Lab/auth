import { createClient } from "@draftlab/auth/client"
import { createSubjects } from "@draftlab/auth/subject"
import { redirect } from "@tanstack/react-router"
import { createServerFn, useServerFn } from "@tanstack/react-start"
import {
	deleteCookie,
	getCookie,
	getRequestHeader,
	setCookie
} from "@tanstack/react-start/server"
import { z } from "zod"

export const getAuthCookieOptions = () => {
	const isProduction = process.env.NODE_ENV === "production"

	return {
		path: "/",
		httpOnly: true,
		secure: isProduction,
		sameSite: "lax" as const,
		maxAge: 60 * 60 * 24 * 7
	}
}

export const client = createClient({
	clientID: "example",
	issuer: "http://localhost:3000/auth"
})

export const subjects = createSubjects({
	user: z.object({
		email: z.string()
	})
})

export const $auth = createServerFn().handler(async () => {
	const accessToken = getCookie("access_token")
	const refreshToken = getCookie("refresh_token")

	if (!accessToken) {
		return null
	}

	const verified = await client.verify(subjects, accessToken, {
		refresh: refreshToken
	})

	if (!verified.success) {
		return null
	}

	if (verified.data.tokens) {
		const cookieOptions = getAuthCookieOptions()
		setCookie("access_token", verified.data.tokens.access, cookieOptions)
		setCookie("refresh_token", verified.data.tokens.refresh, cookieOptions)
	}

	return verified.data.subject.properties
})

export const $login = createServerFn({ method: "POST" }).handler(async () => {
	const accessToken = getCookie("access_token")
	const refreshToken = getCookie("refresh_token")

	if (accessToken) {
		const verified = await client.verify(subjects, accessToken, {
			refresh: refreshToken
		})

		if (verified.success && verified.data.tokens) {
			const cookieOptions = getAuthCookieOptions()
			setCookie("access_token", verified.data.tokens.access, cookieOptions)
			setCookie("refresh_token", verified.data.tokens.refresh, cookieOptions)

			throw redirect({ to: "/" })
		}
	}

	const host = getRequestHeader("Host")
	const protocol = host?.includes("localhost") ? "http" : "https"
	const result = await client.authorize(`${protocol}://${host}/auth/callback`, "code")

	if (result.success) {
		throw redirect({ href: result.data.url })
	}

	throw redirect({ to: "/" })
})

export const $logout = createServerFn({ method: "POST" }).handler(async () => {
	const refreshToken = getCookie("refresh_token")

	if (refreshToken) {
		const revoke = await client.revoke(refreshToken, {
			tokenTypeHint: "refresh_token"
		})

		if (!revoke.success) {
			console.warn("Failed to revoke token on logout:", revoke.error)
		}
	}

	deleteCookie("access_token")
	deleteCookie("refresh_token")

	throw redirect({ to: "/" })
})

export const useAuth = () => {
	const auth = useServerFn($auth)
	const login = useServerFn($login)
	const logout = useServerFn($logout)

	return { login, logout, auth }
}
