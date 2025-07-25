import { createClient } from "@draftlab/auth/client"
import { createSubjects } from "@draftlab/auth/subject"
import { redirect } from "@tanstack/react-router"
import { createServerFn, useServerFn } from "@tanstack/react-start"
import { deleteCookie, getCookie, getHeader, setCookie } from "@tanstack/react-start/server"
import { z } from "zod"

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

	if (!accessToken) return null

	const verified = await client.verify(subjects, accessToken, {
		refresh: refreshToken
	})

	if (!verified.success) return null

	if (verified.data.tokens) {
		setCookie("access_token", verified.data.tokens.access, {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 34560000
		})

		setCookie("refresh_token", verified.data.tokens.refresh, {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 34560000
		})
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
			setCookie("access_token", verified.data.tokens.access, {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				maxAge: 34560000
			})

			setCookie("refresh_token", verified.data.tokens.refresh, {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				maxAge: 34560000
			})

			throw redirect({ to: "/" })
		}
	}

	const host = getHeader("host")
	const protocol = host?.includes("localhost") ? "http" : "https"
	const result = await client.authorize(`${protocol}://${host}/auth/callback`, "code")

	if (result.success) throw redirect({ href: result.data.url })

	throw redirect({ to: "/" })
})

export const $logout = createServerFn({ method: "POST" }).handler(async () => {
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
