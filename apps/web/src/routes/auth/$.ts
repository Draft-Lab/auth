import { issuer } from "@draftlab/auth/core"
import { GithubProvider } from "@draftlab/auth/provider/github"
import { MemoryStorage } from "@draftlab/auth/storage/memory"
import { createFileRoute } from "@tanstack/react-router"
import { subjects } from "@/libs/auth"

const id = crypto.randomUUID()

export const auth = issuer({
	subjects,
	basePath: "/auth",
	ttl: {
		reuse: 0,
		access: 3600,
		refresh: 604800,
		retention: 1209600
	},
	storage: MemoryStorage({
		persist: "./persist.json"
	}),
	providers: {
		github: GithubProvider({
			scopes: ["user:email", "read:user"],
			clientID: process.env.GITHUB_CLIENT_ID ?? "",
			clientSecret: process.env.GITHUB_CLIENT_SECRET ?? ""
		})
	},
	success: (ctx, value) => {
		if (value.provider === "github") {
			return ctx.subject(
				"user",
				{
					email: value.tokenset.access
				},
				{ subject: `user:${id}` }
			)
		}

		throw new Error("Unknown provider")
	}
})

export const Route = createFileRoute("/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => auth.fetch(request),
			POST: ({ request }) => auth.fetch(request)
		}
	}
})
