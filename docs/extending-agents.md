# Extending agents

AI Startup Validator is built around an **`AgentSpec` registry** so you can add, remove, or replace agents without touching the API route, settings defaults, or UI components.

## How the registry works

`src/agents/registry.ts` exports `REGISTRY: AgentSpec[]`. Each spec describes one agent:

```ts
interface AgentSpec {
  id: AgentId;                 // unique key
  info: AgentInfo;             // name, nameZh, role (shown in UI)
  defaultEnabled: boolean;     // on by default in Settings
  isJudge: boolean;            // only one judge
  scoreKey?: keyof Scores;     // which score this agent informs (optional)
  buildSystemPrompt: (depth: Depth) => string;
  buildUserPrompt: (idea, ctx) => string;
  run: (idea, onChunk, opts) => Promise<AgentResult>;
}
```

Everything else derives from the registry:

- `ANALYST_SPECS` — non-judge specs, iterated by the API route in order.
- `JUDGE_SPEC` — the single judge.
- `AGENT_INFOS` — drives `AGENTS` in `types.ts`, which feeds the sidebar, settings panel agent toggles, and agent cards.
- `defaultEnabledAgents()` — seeds `DEFAULT_SETTINGS.enabledAgents`.

## Adding an analyst agent (full example)

Suppose you want a **Legal Agent** that assesses regulatory risk.

### 1. Update the `AgentId` union and `AGENTS` array

`src/lib/types.ts`:

```ts
export type AgentId =
  | "ceo" | "market" | "competitor" | "revenue" | "technical"
  | "legal"            // <- add
  | "judge";

export const AGENTS: AgentInfo[] = [
  // ...existing...
  { id: "legal", name: "Legal Agent", nameZh: "合规智能体", role: "法规风险 · 合规要求" },
];
```

If your agent introduces a **new score**, also extend `Scores`:

```ts
export interface Scores {
  market: number; competition: number; monetization: number; technical: number;
  legal: number;        // <- add
  overall: number;
}
```

And update `JudgeOutputSchema` / `ScoresSchema` in `src/agents/judge-schema.ts` so the Judge includes it.

### 2. Create the agent module

`src/agents/legal.ts`:

```ts
import { chatTextStream } from "@/lib/llm";
import { getSystemPrompt, userPromptFor } from "@/lib/prompts";
import { DEPTH_TOKENS, type Depth, type Provider } from "@/lib/settings";
import type { AgentResult } from "@/lib/types";

interface LegalOptions {
  signal?: AbortSignal;
  provider: Provider;
  model: string;
  depth?: Depth;
}

export async function runLegalAgent(
  idea: string,
  onChunk: (delta: string) => void,
  opts: LegalOptions
): Promise<AgentResult> {
  const { signal, provider, model, depth = "balanced" } = opts;
  const markdown = await chatTextStream(
    getSystemPrompt("legal", depth),
    userPromptFor(idea),
    onChunk,
    { provider, model, signal, maxTokens: DEPTH_TOKENS[depth].analyst }
  );
  return { id: "legal", markdown: markdown.trim() };
}
```

### 3. Add the system prompt

`src/lib/prompts.ts` — add a `LEGAL_BASE` string and register it in `SYSTEM_PROMPTS_BASE`:

```ts
const LEGAL_BASE = `你是合规顾问，评估 AI 创业想法的法规风险：
## 主要法规风险
## 数据隐私
## 行业准入
## 建议措施`;
```

### 4. Register the spec

`src/agents/registry.ts`:

```ts
import { runLegalAgent } from "./legal";

// inside REGISTRY, before the judge entry:
{
  id: "legal",
  info: info("legal"),
  defaultEnabled: true,
  isJudge: false,
  scoreKey: "legal",
  buildSystemPrompt: (d) => getSystemPrompt("legal", d),
  buildUserPrompt: (idea) => userPromptFor(idea),
  run: runLegalAgent,
},
```

Re-export `runLegalAgent` from `src/agents/index.ts` if other code imports it by name.

### 5. Verify

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Start the dev server — the Legal Agent now appears in the sidebar agent list, the settings "enabled agents" grid, and runs in sequence before the Judge. **No UI or route changes required.**

## Reordering agents

The API route runs analysts in `REGISTRY` order. Move a spec earlier or later in the array to change execution order. The Judge always runs last.

## Replacing an agent

Swap the `run` function in an existing spec (keep the same `id`) — UI labels stay the same, behaviour changes. Or replace the entire spec object.

## Disabling an agent by default

Set `defaultEnabled: false` on a spec. Existing users keep their saved preference; new users see it off.
