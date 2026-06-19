# AI Startup Validator

Multi-agent system that validates an AI startup idea. Enter an idea, five analyst agents analyze it in sequence with live streaming output, and a Judge agent synthesizes their reports into a final scored recommendation.

## Agents

1. **CEO** — target users, market positioning, business model
2. **Market** — demand, growth potential, competitive intensity
3. **Competitor** — uses SerpApi to find real competitors, then analyzes pros/cons
4. **Revenue** — monetization paths (subscription, ads, affiliate, enterprise)
5. **Technical** — build difficulty, tech risk, AI model needs, cost
6. **Judge** — synthesizes all results into 0–10 scores + final recommendation

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- DeepSeek API (OpenAI-compatible) for LLM
- SerpApi for competitor search
- Serial agent execution via SSE for clear per-agent progress

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in your keys
pnpm dev
```

Open http://localhost:3000.

API Keys can be configured in two ways:

1. **`.env.local` (recommended for developers)** — set `DEEPSEEK_API_KEY` and `SERPAPI_KEY` as environment variables.
2. **In-app Settings panel (for end users)** — click the gear icon in the sidebar to add or edit model providers and paste your keys. They are stored only in your browser's `localStorage` and sent directly to the respective official APIs.

A valid LLM provider is **required** to run validation. The app comes with a built-in DeepSeek provider and supports any OpenAI-compatible or Anthropic Messages endpoint. Without a configured key, the submit button is disabled and a banner prompts you to configure a provider first.

## Environment variables

| Var | Description |
|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | Defaults to `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | Model name (default `deepseek-v4-flash`) |
| `SERPAPI_KEY` | SerpApi key for competitor search |
| `APP_AUTH_PASSWORD` | Optional bearer token required by all API routes (for public deployments) |

## Scripts

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm start      # serve production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint src
pnpm test       # vitest run
```

## Extending

Add or replace agents via the `AgentSpec` registry — see [`docs/extending-agents.md`](docs/extending-agents.md). For architecture details, see [`docs/architecture.md`](docs/architecture.md).

## Security

This is primarily a **local bring-your-own-key** tool. For public deployment risks (shared env keys, SSRF via custom provider URLs, rate limiting) and mitigations, see [`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE)
