import { describe, it, expect } from "vitest";
import { parseJSON } from "@/lib/llm";

describe("parseJSON", () => {
  it("parses bare JSON object", () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips ```json fences", () => {
    const raw = '```json\n{"a":2}\n```';
    expect(parseJSON<{ a: number }>(raw)).toEqual({ a: 2 });
  });

  it("strips ``` fences without json label", () => {
    const raw = '```\n{"b":3}\n```';
    expect(parseJSON<{ b: number }>(raw)).toEqual({ b: 3 });
  });

  it("extracts JSON embedded in prose", () => {
    const raw = 'Here is the result: {"c":4} done';
    expect(parseJSON<{ c: number }>(raw)).toEqual({ c: 4 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJSON("not json at all")).toThrow();
  });
});
