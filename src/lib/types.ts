export type AgentId =
  | "ceo"
  | "market"
  | "competitor"
  | "revenue"
  | "technical"
  | "judge";

export type AgentStatus = "pending" | "running" | "done" | "error";

export interface AgentInfo {
  id: AgentId;
  name: string;
  nameZh: string;
  role: string;
}

export const AGENTS: AgentInfo[] = [
  { id: "ceo", name: "CEO Agent", nameZh: "CEO 智能体", role: "项目拆解 · 目标用户 · 商业模式" },
  { id: "market", name: "Market Agent", nameZh: "市场智能体", role: "市场需求 · 增长潜力 · 竞争激烈度" },
  { id: "competitor", name: "Competitor Agent", nameZh: "竞品智能体", role: "SerpApi 检索 · 竞品优缺点" },
  { id: "revenue", name: "Revenue Agent", nameZh: "变现智能体", role: "订阅 · 广告 · 联盟 · 企业服务" },
  { id: "technical", name: "Technical Agent", nameZh: "技术智能体", role: "开发难度 · 技术风险 · 成本" },
  { id: "judge", name: "Judge Agent", nameZh: "评审智能体", role: "综合评分 · 最终建议" },
];

export interface AgentResult {
  id: AgentId;
  markdown: string;
}

export interface Scores {
  market: number;
  competition: number;
  monetization: number;
  technical: number;
  overall: number;
}

export interface ReportSummary {
  idea: string;
  scores: Scores;
  recommendation: string;
  verdict: "go" | "caution" | "no-go";
}

export interface HistoryItem {
  id: string;
  idea: string;
  timestamp: number;
  scores: Scores;
  verdict: ReportSummary["verdict"];
  recommendation: string;
  agents: AgentResult[];
}

export type { AppSettings, Depth } from "./settings";

export type SSEEvent =
  | { type: "plan"; idea: string; agents: AgentId[] }
  | { type: "agent:start"; id: AgentId }
  | { type: "agent:chunk"; id: AgentId; delta: string }
  | { type: "agent:done"; id: AgentId; markdown: string }
  | { type: "agent:error"; id: AgentId; message: string }
  | { type: "complete"; summary: ReportSummary }
  | { type: "error"; message: string };
