import { describe, expect, it } from "vitest";
import { buildQuadrants, hashString, resolveCoverFill } from "../coverArt";

describe("coverArt", () => {
  it("hashString is deterministic", () => {
    expect(hashString("Soft Static")).toBe(hashString("Soft Static"));
    expect(hashString("Soft Static")).not.toBe(hashString("Paper Clouds"));
  });

  it("buildQuadrants returns [] for an empty playlist", () => {
    expect(buildQuadrants([])).toEqual([]);
  });

  it("buildQuadrants loops titles when fewer than 4 songs exist", () => {
    const swatches = buildQuadrants(["Alpha", "Beta"]);
    expect(swatches).toHaveLength(4);
    expect(swatches[0].glyph).toBe("A");
    expect(swatches[1].glyph).toBe("B");
    expect(swatches[2].glyph).toBe("A");
    expect(swatches[3].glyph).toBe("B");
  });

  it("resolveCoverFill prefers a custom image over the collage", () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const result = resolveCoverFill(blob, ["Song A"]);
    expect(result).toEqual({ kind: "image", blob });
  });

  it("resolveCoverFill falls back to empty-placeholder with zero songs and no image", () => {
    expect(resolveCoverFill(undefined, [])).toEqual({ kind: "empty-placeholder" });
  });

  it("resolveCoverFill builds quadrants when there are songs but no custom image", () => {
    const result = resolveCoverFill(undefined, ["Song A", "Song B"]);
    expect(result.kind).toBe("quadrants");
  });
});
