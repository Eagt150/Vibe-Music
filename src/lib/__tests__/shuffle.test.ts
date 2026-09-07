import { describe, expect, it } from "vitest";
import { fisherYatesShuffle } from "../shuffle";

describe("fisherYatesShuffle", () => {
  it("preserves all elements (same multiset)", () => {
    const input = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle(input);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    fisherYatesShuffle(input);
    expect(input).toEqual(copy);
  });

  it("handles empty and single-element arrays", () => {
    expect(fisherYatesShuffle([])).toEqual([]);
    expect(fisherYatesShuffle([1])).toEqual([1]);
  });
});
