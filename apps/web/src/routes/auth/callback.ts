import { createFileRoute, redirect } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { setCookie } from "@tanstack/react-start/server"
import { client, getAuthCookieOptions } from "@/libs/auth"

export const Route = createFileRoute("/auth/callback")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const code = url.searchParams.get("code")
				if (!code) return json({ error: "no_code" }, { status: 400 })
				const exchanged = await client.exchange(code, `${url.origin}/auth/callback`)
				if (!exchanged.success) return json(exchanged.error, { status: 400 })

				const cookieOptions = getAuthCookieOptions()
				setCookie("access_token", exchanged.data.access, cookieOptions)
				setCookie("refresh_token", exchanged.data.refresh, cookieOptions)

				throw redirect({ to: "/" })
			}
		}
	}
})
