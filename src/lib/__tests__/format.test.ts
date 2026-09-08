import { describe, expect, it } from "vitest";
import { formatBytes, formatCountdown, formatDuration } from "../format";

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

describe("formatBytes", () => {
  it("formats bytes under 1KB as-is", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
  it("formats KB/MB/GB with one decimal under 10", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("drops the decimal at 10 or more", () => {
    expect(formatBytes(120 * 1024 * 1024)).toBe("120 MB");
  });
});

describe("formatCountdown", () => {
  it("formats milliseconds as mm:ss, rounding up", () => {
    expect(formatCountdown(90_500)).toBe("1:31");
    expect(formatCountdown(5_000)).toBe("0:05");
  });
  it("clamps negative to zero", () => {
    expect(formatCountdown(-100)).toBe("0:00");
  });
});
