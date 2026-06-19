# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities. Instead, email the maintainers directly or use GitHub's private vulnerability reporting. Include a description and reproduction steps. We aim to respond within 72 hours.

## Deployment risk checklist

AI Startup Validator is designed primarily as a **local, bring-your-own-key (BYOK)** tool. If you deploy it to the public internet, be aware of these risks and mitigations:

### 1. Server-side env keys are shared

If you set `DEEPSEEK_API_KEY` / `SERPAPI_KEY` in `.env.local` on a public deployment, **any visitor** can consume your quota via the app. There is no per-user accounting.

**Mitigation**: Set `APP_AUTH_PASSWORD` to require a bearer token on all API routes. Users set the matching token in their browser via `localStorage["asv_auth_token"]`. Combine with a reverse proxy that adds authentication and rate limiting.

### 2. Custom provider baseUrl = SSRF surface

The settings panel lets users add arbitrary model providers with a custom `baseUrl`. The server then makes outbound HTTP requests to that URL. On a public deployment this is a Server-Side Request Forgorage (SSRF) vector.

**Mitigation**: For public deployments, disable custom-provider creation (fork and restrict the SettingsPanel) or run a baseUrl allowlist. For local-only use this is acceptable since the user controls the server.

### 3. Rate limiting

The built-in rate limiter (`src/lib/rate-limit.ts`) caps `/api/validate` at 10 requests/minute per IP in-memory. This is a basic guard, not a robust solution. For production, put a real rate limiter / WAF in front (e.g. Cloudflare, nginx limit_req).

### 4. API keys in localStorage

User-entered keys are stored in `localStorage` and sent only to the respective official APIs (DeepSeek / SerpApi / custom provider). They are never sent to any third party. Ensure your deployment is served over HTTPS so the POST body (which contains keys) is encrypted in transit.

## Supported versions

Only the latest release line receives security updates.
