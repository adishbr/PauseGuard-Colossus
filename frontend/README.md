# PauseGuard frontend · Demo accounts and guardian enrollment

A local V2 payment simulation with fictional payer and guardian accounts. Use the synthetic contact, recipient and purpose options.

## Run locally

Use Node.js 24 and the locked frontend dependencies.

```sh
npm ci
npm run dev
```

1. Open the local URL shown by Vite. Choose **Log in** then **Open sample payer** for the pre-enrolled walkthrough, or **Get started** to create a fictional payer. In the payer's **Payment Protection Settings**, select **30 seconds**, **45 seconds**, or **60 seconds**, then choose **Save settings**. The default is 30 seconds. On a phone, the link above the payment steps jumps to the settings card.
2. Open **Guardian portal** from the public homepage in a separate tab. Choose **Open sample guardian** for the sample walkthrough or sign in with the fictional contact that accepted the invitation. In the payer workspace, select **Coerced KYC transfer** and **Check payment**. In the guardian workspace, select **Open review**. In a separate browser profile, open `/guardian` and paste the request reference from the payer screen.
3. Reject the request to stop the transfer, or approve the review to return control to the payer for a separate **Confirm simulated payment** action. If the selected review window closes first, both screens show the hold. The payer can stop the request.
4. Try **Everyday purchase** for a routine confirmation or **Unfamiliar supplier** for a warning before confirmation. Try **Flagged recipient** for an immediate simulated safety block. These cases skip guardian review.

`npm run build` and `npm run preview` also support the local demo. The Vite fixture keeps state in memory. A server restart clears its requests. Browser reloads on the same server recover the selected request. An unavailable payer reference can be cleared from the status screen.

## Accounts and protection

- **Payer** — Sign up in two steps with a fictional name and a `.test` email or a synthetic 10-digit mobile beginning with `00000`. Choose an account category and language. Profile includes large text, business and recurring supplier preferences, a payment alert threshold, optional notifications, quiet hours, call consent and simulated Safe-Lock.
- **Guardians** — Open **Guardians** on the payer dashboard, opt in, enter a fictional guardian and consent to sharing. Share the displayed demo link. The guardian signs in or registers with the matching fictional contact, then accepts with consent or declines in **Invitations**. Payers can revoke and guardians can withdraw enrollment. A new enrollment applies to new review requests.
- **Review privacy** — A guardian receives an assigned active review reference and the redacted V2 response. A high-risk request without an accepted guardian goes to fallback. Revocation closes access to pending reviews, and final confirmation rechecks Safe-Lock and enrollment.
- **Sessions** — The fixture issues 30-minute demo sessions per role and keeps fictional accounts, invitations and payments in memory until the local server restarts. The browser keeps each role's token in session storage and the review window preference in local storage by payer account. Preview sign-in uses synthetic account selection.
- **Other routes** — Help & recovery provides reporting links and a demo request reference. `/analyst` is an integration shell. `/admin` opens the existing administrator payment testing workspace.
- **Simulation limits** — Keep the fixture local and use fictional data. Notification, quiet-hours and call controls save preferences. Delivery, contact verification, audit evidence export and identity security depend on backend integration. The existing payment interface retains four language catalogs. New account and enrollment pages use English copy.

## Phase 2 experience

- The payer can follow Prepare, Review and Outcome, read verification guidance, copy a request reference and confirm separately after approval.
- The guardian sees a limited alert, the server-set deadline and practical ways to verify the request. Separate browser profiles can paste the reference.
- English, Kannada, Hindi and Telugu catalogs cover the demo UI. The language selector remembers the choice in the browser. Amount entry accepts ASCII and the three regional digit sets and sends integer paise. The [bundled Noto script fonts](public/noto-font-license.txt) load locally. Native-speaker review is pending for the translations.
- Status reads back off during network failures and refresh on reconnect. Actions pause while the latest state is unavailable. If a mutation response is lost, the UI fetches status before another action. A create retry reuses its original idempotency key.

## API handoff

The browser uses the documented `/api/v2` payment paths with separate synthetic bearer identities. Browser storage shares only the guardian request reference across windows. The guardian always loads the authorized view from HTTP. That view contains only `id`, `status`, `tier`, `guardian_deadline`, and a generic `message`. In a separate profile the reference is entered manually.

| Action | Request |
|---|---|
| Create | `POST /payments` with `beneficiary_id`, integer `amount_paise`, `purpose`, and `idempotency_key` |
| Reload | `GET /payments/{id}` with the payer or guardian demo bearer token |
| Warning acknowledgement | `POST /payments/{id}/warning/acknowledge` with an empty JSON object |
| Guardian review | `POST /payments/{id}/guardian/decision` with `{"decision":"approve"}` or `{"decision":"reject"}` |
| Cancel | `POST /payments/{id}/cancel` with an empty JSON object |
| Confirm | `POST /payments/{id}/confirm` with `{"idempotency_key":"confirm:<payment-id>"}` |

The demo saves the duration preference in the payer's browser. The client sends a demo-only `X-PauseGuard-Demo-Review-Seconds` header with the create request. The fixture validates the hint, sets `guardian_deadline` once when a review is required, and returns the effective window as a demo-only response header for the progress bar. The canonical request and response JSON remain unchanged. Both windows calculate the countdown from the same deadline. Saving another duration applies to future payments, and retries keep the original deadline.

Komal should verify the fixture's guardian decision and confirmation payloads against the backend's eventual OpenAPI schema. The fixture advances the deadline on payment reads and applicable actions using server time. It models an execution state without a ledger. The browser polls active requests and refreshes on reconnect. The shared contract leaves event delivery for later integration. The client validates the response before rendering it and rejects guardian responses containing extra fields. The local fixture checks expiring demo session tokens and enrollment on each review request. Keep the server local.

## Checks

```sh
npm run build
npm run lint
npm test
```

With the demo server running and Playwright plus Chromium available, run `npm run test:browser`. Set `PLAYWRIGHT_MODULE` to the installed Playwright module path when using shared tooling. Optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for an existing Chromium binary or `PAUSEGUARD_TEST_ORIGIN` for a different local port.

The browser cases cover the two-window flow and expiry at all three durations, preference persistence, refresh and reconnect during active review, mobile validation and focus, reduced motion, local fonts, warning acknowledgement, lost confirmation responses, malformed guardian payloads and blocked recipients. Fixture and client tests cover state transitions, authorization, expiry, replay, paise conversion and response validation.

## Demo account adapter and backend handoff

Account requests are isolated under `/__pauseguard/demo` with `POST /register`, `GET/POST/DELETE /session`, `POST /profile`, `GET/POST /enrollment`, and `GET /reviews`. The existing payment JSON and V2 state names are unchanged.

Komal should define real registration, identity verification, session and account recovery, role claims, profile and preference persistence, invitation binding and acceptance, revocation, notification delivery and review discovery. Replace the demo adapter with the approved interfaces and test object-level access against the real service.

## Phase 3 integration

1. Confirm the `/api/v2` OpenAPI schema with Komal, including identity-scoped access, exact action payloads, errors, deadlines and idempotency. Exercise the same tests against the agreed backend fixture.
2. Connect authenticated payer and guardian sessions and verified guardian enrollment. Keep the guardian payload limited and preserve authorization on every read and action.
3. Agree on the privacy-safe event or notification contract. Re-fetch authoritative status on reconnect and keep expiry and fallback decisions on the backend.
4. Replace the demo header with the agreed server-side preference contract. Continue to use the backend's `guardian_deadline` in both windows. Integrate independent verification when the backend supports it. Review the localized safety copy and test it on target devices.

## Design references

- Public hero reference: [Woven Light Hero](https://21st.dev/@dhileepkumargm/components/woven-light-hero), Dhileep Kumar GM. The particle lock is implemented locally.
- Sign-in artwork: [Dark Fusion](https://unsplash.com/photos/abstract-chrome-sculpture-on-black-background-vmvlYqgURY4) by Luke Hales, under the [Unsplash License](https://unsplash.com/license).
