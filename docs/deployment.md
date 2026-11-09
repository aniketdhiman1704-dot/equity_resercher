# Put the website online

Prepared: 10 November 2026 (Asia/Calcutta). This configuration requests one **Free** Render web service. The application and configuration are uploaded to [the deployment branch](https://github.com/aniketdhiman1704-dot/equity_resercher/tree/deploy/free-hosting). A hosted URL is available only after the service is created and its deployment succeeds.

## Create the service

1. Sign into [Render](https://dashboard.render.com/) with GitHub and allow access to `aniketdhiman1704-dot/equity_resercher`.
2. Choose **New → Blueprint**, select that repository, and select branch **deploy/free-hosting**. The `render.yaml` in that branch describes the service. If using **New → Web Service** instead, use the settings below.
3. Enter `SEC_USER_AGENT` as an application name followed by your genuine contact email. It identifies SEC requests; it is not an API key. Keep this in Render's environment settings, never a `VITE_` variable or committed file.
4. Review that the service uses the **Free** plan and creates no database or other paid resource, then deploy. If Free is unavailable for your account, stop rather than accepting a paid plan.
5. Open the HTTPS address Render assigns to the service once the deployment is live. That is the link to share for your CV/interview demo.

Render's dashboard labels and free-plan availability can change. Its documentation could not be fetched from this workspace (proxy CONNECT 403); the actual account configuration and deployment still need verification. No paid plan, card, paid API or model credential is required by this application's configuration. Free hosting has quotas and may sleep when idle; check the dashboard's current terms. Do not use artificial keep-alive traffic to evade free-tier limits.

## Equivalent manual settings

| Setting | Value |
| --- | --- |
| Repository | `aniketdhiman1704-dot/equity_resercher` |
| Branch | `deploy/free-hosting` |
| Runtime | Node |
| Root directory | Repository root; leave blank |
| Plan | Free |
| Build command | `npm ci --include=dev --no-audit && npm run build && npm prune --omit=dev --no-audit` |
| Start command | `npm start` |
| Health check | `/api/health` |
| `NODE_VERSION` | `24.19.0` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `SEC_USER_AGENT` | Application name and your genuine contact email |
| Port | Use the hosting platform's injected `PORT`; do not override it |

Automatic deploys are disabled in the blueprint. Future updates require an explicit manual deploy after tests pass.

## Why this deployment

The compiled Node process serves both the React assets and `/api` under one origin. This preserves the existing browser/server request checks and keeps the SEC contact on the server. A static-only GitHub Pages upload would not run the SEC API. No database, separate frontend host, container registry or serverless rewrite is needed.

The service binds to `0.0.0.0` only when the hosting configuration sets `HOST`. Local development keeps its existing defaults. The server reads the host's port. Build dependencies are installed for TypeScript/Vite, then removed from the deployment's runtime dependencies. All financial calculations and review gates are unchanged.

This is a public research demonstration, not an authenticated multi-user data store. Private CSV inputs stay in the visitor's browser, and the server does not accept private financial uploads. Sessions/reports download to the visitor's device; there is no server-side saving. The SEC cache is bounded and in memory, so it resets on restart/sleep. Keep the initial service to one instance to preserve process-wide request pacing.

## Verify the actual hosted site

- The assigned HTTPS page loads the clearly labelled synthetic sample.
- `/api/health` reports version `0.5.0`, `researchMode: deterministic`, `paidServicesRequired: false` and `secConfigured: true`. Health confirms configuration/process status, not SEC reachability.
- Run the sample research workflow and export a report; verify all three workers render.
- Retrieve MSFT through **SEC filings**, review the financial mappings and load historical data. Confirm unsupported inputs remain blank and DCF stays withheld until its review requirements are met.
- Try a local CSV and Save/Open session. Private files must remain in the browser.

SEC access can differ by hosting network. A successful request from Codex does not establish that Render's outbound address can reach SEC. If the hosted lookup fails, inspect the deployment logs and SEC response; do not bypass a denial or substitute sample figures for a real issuer. Sample/private research remains available independently of SEC.

No live Render deployment or URL has been verified yet. Local deployment-equivalent validation and the Git upload outcome are recorded in `WORKLOG.md`.
