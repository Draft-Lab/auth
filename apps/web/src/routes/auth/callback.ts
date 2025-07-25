import { redirect } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { createServerFileRoute, setCookie } from "@tanstack/react-start/server"
import { client } from "@/libs/auth"

export const ServerRoute = createServerFileRoute("/auth/callback").methods({
	GET: async ({ request }) => {
		const url = new URL(request.url)
		const code = url.searchParams.get("code")
		if (!code) return json({ error: "no_code" }, { status: 400 })
		const exchanged = await client.exchange(code, `${url.origin}/auth/callback`)
		if (!exchanged.success) return json(exchanged.error, { status: 400 })

		setCookie("access_token", exchanged.data.access, {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 34560000
		})

		setCookie("refresh_token", exchanged.data.refresh, {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 34560000
		})

		throw redirect({ to: "/" })
	}
})
