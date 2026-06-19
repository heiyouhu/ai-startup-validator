import { AgentCard, type AgentState } from "./AgentCard";
import { AGENTS, type AgentId } from "@/lib/types";

interface AgentPanelProps {
  agents: Record<AgentId, AgentState>;
  enabledAgents?: Record<AgentId, boolean>;
}

const ANALYST_IDS = AGENTS.filter((a) => a.id !== "judge").map((a) => a.id);

export function AgentPanel({ agents, enabledAgents }: AgentPanelProps) {
  const visibleIds = enabledAgents
    ? ANALYST_IDS.filter((id) => enabledAgents[id] !== false)
    : ANALYST_IDS;

  return (
    <div className="space-y-3">
      {visibleIds.map((id, index) => {
        const info = AGENTS.find((a) => a.id === id)!;
        return (
          <div
            key={id}
            className="card-enter"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <AgentCard info={info} state={agents[id]} />
          </div>
        );
      })}
    </div>
  );
}
