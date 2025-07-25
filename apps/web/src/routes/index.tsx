import { createFileRoute } from "@tanstack/react-router"
import { useAuth } from "@/libs/auth"

export const Route = createFileRoute("/")({
	component: Home
})

function Home() {
	const { login } = useAuth()

	return (
		<main
			style={{
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				width: "100%",
				height: "100vh"
			}}
		>
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
		</main>
	)
}
