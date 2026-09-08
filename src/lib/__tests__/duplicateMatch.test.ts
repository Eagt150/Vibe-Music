import { describe, expect, it } from "vitest";
import { isFuzzyDuplicate, normalizeForMatch } from "../duplicateMatch";

describe("normalizeForMatch", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeForMatch("  Soft   Static ")).toBe("soft static");
  });
});

describe("isFuzzyDuplicate", () => {
  const base = { title: "Soft Static", artist: "Nova Reyes", durationSec: 192 };

  it("matches identical title/artist/duration", () => {
    expect(isFuzzyDuplicate(base, { ...base })).toBe(true);
  });

  it("matches case/whitespace-insensitively", () => {
    expect(isFuzzyDuplicate(base, { title: "  soft static", artist: "NOVA REYES", durationSec: 192 })).toBe(true);
  });

  it("tolerates a small duration difference (different encode of the same file)", () => {
    expect(isFuzzyDuplicate(base, { ...base, durationSec: 193.5 })).toBe(true);
  });

  it("rejects a duration difference beyond the tolerance", () => {
    expect(isFuzzyDuplicate(base, { ...base, durationSec: 200 })).toBe(false);
  });

  it("rejects a different title or artist", () => {
    expect(isFuzzyDuplicate(base, { ...base, title: "Paper Clouds" })).toBe(false);
    expect(isFuzzyDuplicate(base, { ...base, artist: "Kai Loom" })).toBe(false);
  });
});
