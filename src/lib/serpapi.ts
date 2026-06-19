export interface SerpResult {
  title: string;
  link: string;
  snippet: string;
}

export async function searchWeb(query: string, num = 10, apiKey?: string): Promise<SerpResult[]> {
  const key = apiKey || process.env.SERPAPI_KEY;
  if (!key) throw new Error("未配置 SerpApi Key，请在设置面板填写或在 .env.local 中设置 SERPAPI_KEY");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  url.searchParams.set("num", String(num));

  const res = await fetch(url, {
    signal: AbortSignal.timeout(40000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SerpApi ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { organic_results?: Record<string, unknown>[] };
  const organic = data.organic_results ?? [];
  return organic
    .map((r) => ({
      title: String(r.title ?? ""),
      link: String(r.link ?? ""),
      snippet: String(r.snippet ?? (r.about_this_result as { snippet?: string } | undefined)?.snippet ?? ""),
    }))
    .filter((r) => r.title || r.snippet)
    .slice(0, num);
}

export async function searchMulti(
  queries: string[],
  numEach = 8,
  apiKey?: string
): Promise<SerpResult[]> {
  const sets = await Promise.allSettled(queries.map((q) => searchWeb(q, numEach, apiKey)));
  const all: SerpResult[] = [];
  const seen = new Set<string>();
  for (const s of sets) {
    if (s.status !== "fulfilled") continue;
    for (const r of s.value) {
      const key = r.link || r.title;
      if (key && !seen.has(key)) {
        seen.add(key);
        all.push(r);
      }
    }
  }
  return all;
}
