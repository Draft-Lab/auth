/**
 * Passkey authentication UI component
 * Provides complete interfaces for passkey registration and authentication using WebAuthn
 */

import type { PasskeyProviderConfig } from "../provider/passkey"
import { Layout, renderToHTML } from "./base"
import { FormAlert } from "./form"

/**
 * Strongly typed copy text configuration for passkey UI
 */
interface PasskeyUICopy {
	// Page titles and descriptions
	readonly authorize_title: string
	readonly authorize_description: string
	readonly register_title: string
	readonly register_description: string

	// Action buttons and links
	readonly register: string
	readonly register_with_passkey: string
	readonly register_other_device: string
	readonly register_prompt: string
	readonly login_prompt: string
	readonly login: string
	readonly login_with_passkey: string
	readonly change_prompt: string
	readonly code_resend: string
	readonly code_return: string

	// Input placeholders
	readonly input_email: string
}

const DEFAULT_COPY: PasskeyUICopy = {
	// Page titles and descriptions
	authorize_title: "Sign in with Passkey",
	authorize_description:
		"Passkeys are a simple and more secure alternative to passwords. With passkeys, you can log in with your PIN, biometric sensor, or hardware security key.",
	register_title: "Create a Passkey",
	register_description:
		"Create a passkey to enable secure, passwordless authentication for your account.",

	// Action buttons and links
	register: "Register",
	register_with_passkey: "Register With Passkey",
	register_other_device: "Use another device",
	register_prompt: "Don't have an account?",
	login_prompt: "Already have an account?",
	login: "Login",
	login_with_passkey: "Login With Passkey",
	change_prompt: "Forgot password?",
	code_resend: "Resend code",
	code_return: "Back to",

	// Input placeholders
	input_email: "Email"
}

interface PasskeyUIOptions
	extends Omit<PasskeyProviderConfig, "authorize" | "register" | "copy"> {
	readonly copy?: Partial<PasskeyUICopy>
}

export const PasskeyUI = (options: PasskeyUIOptions): PasskeyProviderConfig => {
	const {
		rpName,
		rpID,
		origin,
		userCanRegisterPasskey,
		authenticatorSelection,
		attestationType,
		timeout
	} = options
	const copy = {
		...DEFAULT_COPY,
		...options.copy
	}
	return {
		authorize: async () => {
			const jsx = (
				<Layout>
					<script
						dangerouslySetInnerHTML={{
							__html: `
								window.addEventListener("load", async () => {
									const { startAuthentication } = SimpleWebAuthnBrowser;
									const authorizeForm = document.getElementById("authorizeForm");
									const message = document.querySelector("[data-slot='message']");
									const origin = window.location.origin;
									const rpID = window.location.hostname;
									
									authorizeForm.addEventListener("submit", async (e) => {
										e.preventDefault();
										const formData = new FormData(authorizeForm);
										const email = formData.get("email");
										
										message.textContent = "";

										// GET authentication options from the endpoint that calls
										// @simplewebauthn/server -> generateAuthenticationOptions()
										const resp = await fetch(
											"./authenticate-options?userId=" + email + "&rpID=" + rpID
										);

										const optionsJSON = await resp.json();

										if (optionsJSON.error) {
											message.textContent = optionsJSON.error;
											return;
										}

										let attResp;
										try {
											// Pass the options to the authenticator and wait for a response
											attResp = await startAuthentication({ optionsJSON });
										} catch (error) {
											message.textContent = error;
											throw error;
										}
										
										const verificationResp = await fetch(
											"./authenticate-verify?userId=" +
												email +
												"&rpID=" +
												rpID +
												"&origin=" +
												origin,
											{
												method: "POST",
												headers: {
													"Content-Type": "application/json",
												},
												body: JSON.stringify(attResp),
											}
										);
										
										// Check if the request was redirected and the final response is OK
										if (verificationResp.redirected && verificationResp.ok) {
											// Navigate the browser to the final URL
											window.location.href = verificationResp.url;
										} else {
											// Handle errors (e.g., 4xx, 5xx status codes from the final URL)
											console.error(
												"Request failed:",
												verificationResp.status,
												verificationResp.statusText
											);
											try {
												const errorData = await verificationResp.json();
												message.textContent = errorData.error;
											} catch (error) {
												message.textContent = "Something went wrong";
											}
										}
									});
								});
							`
						}}
					/>
					<h1 data-component="title">{copy.authorize_title}</h1>
					<p data-component="description">{copy.authorize_description}</p>
					<form id="authorizeForm" data-component="form">
						<FormAlert />
						<div data-component="input-group">
							<label htmlFor="auth-email" data-component="input-label">
								{copy.input_email}
								<span data-slot="required">*</span>
							</label>
							<input
								id="auth-email"
								data-component="input"
								type="email"
								name="email"
								aria-required="true"
								aria-describedby="auth-email-help"
								autoComplete="email"
								required
								placeholder={copy.input_email}
							/>
							<div id="auth-email-help" data-component="input-help">
								Enter your email to authenticate with your passkey
							</div>
						</div>
						<button type="submit" id="btnLogin" data-component="button">
							{copy.login_with_passkey}
						</button>
						<div data-component="form-footer">
							<span>
								{copy.register_prompt}{" "}
								<a data-component="link" href="./register">
									{copy.register}
								</a>
							</span>
						</div>
					</form>
					<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
				</Layout>
			)
			return new Response(renderToHTML(jsx), {
				status: 200,
				headers: {
					"Content-Type": "text/html"
				}
			})
		},
		register: async () => {
			const jsx = (
				<Layout>
					<script
						dangerouslySetInnerHTML={{
							__html: `
								window.addEventListener("load", async () => {
									const { startRegistration } = SimpleWebAuthnBrowser;
									const registerForm = document.getElementById("registerForm");
									const message = document.querySelector("[data-slot='message']");
									const origin = window.location.origin;
									const rpID = window.location.hostname;
									
									// Start registration when the user clicks a button
									const register = async (otherDevice = false) => {
										const formData = new FormData(registerForm);
										const email = formData.get("email");
										message.textContent = "";

										// GET registration options from the endpoint that calls
										// @simplewebauthn/server -> generateRegistrationOptions()
										const resp = await fetch(
											"./register-request?userId=" +
												email +
												"&origin=" +
												origin +
												"&rpID=" +
												rpID +
												"&otherDevice=" +
												otherDevice
										);
										const optionsJSON = await resp.json();

										if (optionsJSON.error) {
											message.textContent = optionsJSON.error;
											return;
										}

										let attResp;
										try {
											// Pass the options to the authenticator and wait for a response
											attResp = await startRegistration({ optionsJSON });
										} catch (error) {
											message.textContent = error;
											throw error;
										}

										// POST the response to the endpoint that calls
										// @simplewebauthn/server -> verifyRegistrationResponse()
										try {
											const verificationResp = await fetch(
												"./register-verify?userId=" +
													email +
													"&origin=" +
													origin +
													"&rpID=" +
													rpID,
												{
													method: "POST",
													headers: {
														"Content-Type": "application/json",
													},
													body: JSON.stringify(attResp),
												}
											);

											// Check if the request was redirected and the final response is OK
											if (verificationResp.redirected && verificationResp.ok) {
												// Navigate the browser to the final URL
												window.location.href = verificationResp.url;
											} else {
												// Handle errors (e.g., 4xx, 5xx status codes from the final URL)
												console.error(
													"Request failed:",
													verificationResp.status,
													verificationResp.statusText
												);
												try {
													const errorData = await verificationResp.json();
													message.textContent = errorData.error;
												} catch (error) {
													message.textContent = "Something went wrong";
												}
											}
										} catch (error) {
											console.error(error);
											message.textContent = "Something went wrong";
										}
									};
									
									registerForm.addEventListener("submit", (e) => {
										e.preventDefault();
										register();
									});
								});
							`
						}}
					/>

					<h1 data-component="title">{copy.register_title}</h1>
					<p data-component="description">{copy.register_description}</p>
					<form id="registerForm" data-component="form">
						<FormAlert />
						<div data-component="input-group">
							<label htmlFor="reg-email" data-component="input-label">
								{copy.input_email}
								<span data-slot="required">*</span>
							</label>
							<input
								id="reg-email"
								data-component="input"
								type="email"
								name="email"
								aria-required="true"
								aria-describedby="reg-email-help"
								autoComplete="email"
								required
								placeholder={copy.input_email}
							/>
							<div id="reg-email-help" data-component="input-help">
								Enter your email to register a new passkey
							</div>
						</div>
						<button data-component="button" type="submit" id="btnRegister">
							{copy.register_with_passkey}
						</button>
						<button data-component="button" type="submit" id="btnOtherDevice">
							{copy.register_other_device}
						</button>
						<div data-component="form-footer">
							<span>
								{copy.login_prompt}{" "}
								<a data-component="link" href="./authorize">
									{copy.login}
								</a>
							</span>
						</div>
					</form>
					<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
				</Layout>
			)
			return new Response(renderToHTML(jsx), {
				status: 200,
				headers: {
					"Content-Type": "text/html"
				}
			})
		},
		rpName,
		rpID,
		origin,
		userCanRegisterPasskey,
		authenticatorSelection,
		attestationType,
		timeout
	}
}
