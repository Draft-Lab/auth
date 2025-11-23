import { createFileRoute } from "@tanstack/react-router"
import { $auth, useAuth } from "@/libs/auth"

export const Route = createFileRoute("/")({
	component: Home,
	beforeLoad: async () => {
		const user = await $auth()
		return { user }
	}
})

function Home() {
	const { login, logout } = useAuth()
	const { user } = Route.useRouteContext()

	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				width: "100%",
				height: "100vh",
				gap: "20px"
			}}
		>
			{user?.email && <p style={{ fontSize: "18px" }}>Email: {user.email}</p>}

			{user?.email ? (
				<button
					type="button"
					onClick={async () => await logout()}
					style={{
						padding: "10px 20px",
						fontSize: "16px",
						color: "#fff",
						backgroundColor: "#dc3545",
						border: "none",
						borderRadius: "5px",
						cursor: "pointer",
						transition: "background-color 0.3s"
					}}
				>
					Logout
				</button>
			) : (
				<button
					type="button"
					onClick={async () => await login()}
					style={{
						padding: "10px 20px",
						fontSize: "16px",
						color: "#fff",
						backgroundColor: "#007bff",
						border: "none",
						borderRadius: "5px",
						cursor: "pointer",
						transition: "background-color 0.3s"
					}}
				>
					Login
				</button>
			)}
		</main>
	)
}
