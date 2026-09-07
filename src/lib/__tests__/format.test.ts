import { describe, expect, it } from "vitest";
import { formatDuration } from "../format";

describe("formatDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatDuration(5)).toBe("0:05");
  });
  it("formats minutes:seconds", () => {
    expect(formatDuration(192)).toBe("3:12");
  });
  it("formats hours for audiobook-length files", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });
  it("clamps negative input to zero", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });
});
