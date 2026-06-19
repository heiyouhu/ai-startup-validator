# Contributing to AI Startup Validator

Thanks for your interest in contributing! This guide covers setup, adding agents, and PR conventions.

## Development setup

```bash
pnpm install
cp .env.example .env.local   # fill in DEEPSEEK_API_KEY (and SERPAPI_KEY if testing competitor search)
pnpm dev
```

Open http://localhost:3000.

## Quality checks before submitting

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint src
pnpm test        # vitest run
pnpm build       # production build
```

All four must pass. CI runs them on Node 20 and 22.

## Adding a new agent

The project uses an `AgentSpec` registry so adding an agent only touches ~2 places.

1. **Add an `AgentId`** in `src/lib/types.ts` (the union type) and a matching entry to the `AGENTS` array (id / name / nameZh / role).

2. **Create `src/agents/<your-agent>.ts`** exporting a `runYourAgent` function with the signature:
   ```ts
   export async function runYourAgent(
     idea: string,
     onChunk: (delta: string) => void,
     opts: YourOptions
   ): Promise<AgentResult>
   ```
   Use `chatTextStream` from `@/lib/llm` and `DEPTH_TOKENS` from `@/lib/settings`.

3. **Register a spec** in `src/agents/registry.ts`:
   ```ts
   {
     id: "your-agent",
     info: info("your-agent"),
     defaultEnabled: true,
     isJudge: false,
     scoreKey: "market",        // optional: which Scores field this agent informs
     buildSystemPrompt: (d) => getSystemPrompt("your-agent", d),
     buildUserPrompt: (idea) => userPromptFor(idea),
     run: runYourAgent,
   }
   ```
   Add the system prompt text to `src/lib/prompts.ts`.

That's it — the API route, settings defaults, and UI (sidebar / settings panel / agent cards) all derive from the registry. If your agent contributes a new score dimension, also update `Scores` in `src/lib/types.ts` and the Judge schema in `src/agents/judge-schema.ts`.

## Commit & PR style

- Use clear, imperative commit subjects: `Fix model selection ignoring selectedModel`.
- Keep PRs focused; one feature or fix per PR.
- Include tests for pure-function logic (parsing, scoring, validation) under `src/**/*.test.ts`.
- Don't commit secrets or `.env.local`.

## Reporting issues

Open a GitHub issue with: reproduction steps, expected vs actual, and relevant logs (redact API keys).
