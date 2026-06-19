import type { AgentId } from "./types";
import { defaultEnabledAgents } from "@/agents/registry";

export type Depth = "concise" | "balanced" | "detailed";
export type ApiFormat = "openai" | "anthropic";

export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  format: ApiFormat;
  models: string[];
}

export interface AppSettings {
  providers: Provider[];
  selectedProviderId: string;
  selectedModel: string;
  depth: Depth;
  searchEnabled: boolean;
  searchQueries: 2 | 3 | 5;
  searchResultsPerQuery: 5 | 8 | 10;
  searchResultsToLLM: 10 | 15 | 20;
  enabledAgents: Record<AgentId, boolean>;
  apiKeys: {
    serpapi: string;
  };
}

export const DEPTH_TOKENS: Record<Depth, { analyst: number; judge: number }> = {
  concise: { analyst: 900, judge: 1200 },
  balanced: { analyst: 1800, judge: 2400 },
  detailed: { analyst: 2400, judge: 3200 },
};

export const DEFAULT_PROVIDER: Provider = {
  id: "deepseek",
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  format: "openai",
  models: ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-reasoner"],
};

export const DEFAULT_SETTINGS: AppSettings = {
  providers: [DEFAULT_PROVIDER],
  selectedProviderId: DEFAULT_PROVIDER.id,
  selectedModel: DEFAULT_PROVIDER.models[0],
  depth: "balanced",
  searchEnabled: true,
  searchQueries: 5,
  searchResultsPerQuery: 8,
  searchResultsToLLM: 20,
  enabledAgents: defaultEnabledAgents(),
  apiKeys: {
    serpapi: "",
  },
};

const KEY = "asv_settings";

interface LegacySettings {
  model?: string;
  apiKeys?: { deepseek?: string; serpapi?: string };
}

function migrateFromLegacy(parsed: Partial<AppSettings> & LegacySettings): Partial<AppSettings> {
  if (parsed.providers && parsed.providers.length > 0) return parsed;

  const provider: Provider = {
    ...DEFAULT_PROVIDER,
    apiKey: parsed.apiKeys?.deepseek?.trim() || "",
  };

  const selectedModel =
    parsed.model && provider.models.includes(parsed.model)
      ? parsed.model
      : provider.models[0];

  return {
    ...parsed,
    providers: [provider],
    selectedProviderId: provider.id,
    selectedModel,
    apiKeys: {
      serpapi: parsed.apiKeys?.serpapi?.trim() || "",
    },
  };
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings> & LegacySettings;
    const migrated = migrateFromLegacy(parsed);
    return {
      ...DEFAULT_SETTINGS,
      ...migrated,
      enabledAgents: { ...DEFAULT_SETTINGS.enabledAgents, ...migrated.enabledAgents },
      apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...migrated.apiKeys },
      providers:
        migrated.providers?.map((p, i) => ({
          ...DEFAULT_PROVIDER,
          ...p,
          id: p.id || `provider-${i}`,
          models: p.models?.length ? p.models : DEFAULT_PROVIDER.models,
        })) ?? DEFAULT_SETTINGS.providers,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function findProvider(settings: AppSettings, providerId?: string): Provider | undefined {
  const id = providerId ?? settings.selectedProviderId;
  return settings.providers.find((p) => p.id === id);
}

export function selectedProvider(settings: AppSettings): Provider | undefined {
  return findProvider(settings);
}

export function selectedModel(settings: AppSettings): string {
  const p = selectedProvider(settings);
  if (!p) return "";
  return p.models.includes(settings.selectedModel) ? settings.selectedModel : p.models[0] || "";
}

export function isProviderReady(provider: Provider | undefined, serverEnvKey?: boolean): boolean {
  if (!provider) return false;
  if (provider.apiKey.trim()) return true;
  if (provider.id === "deepseek") return !!serverEnvKey;
  return false;
}
