import { describe, expect, it } from "vitest";
import { extractMetadata } from "../metadata";

function fakeFile(name: string, content = "not real audio bytes"): File {
  return new File([content], name, { type: "audio/mpeg" });
}

describe("extractMetadata fallback path", () => {
  it("derives a title-cased title from the filename when tags can't be parsed", async () => {
    const result = await extractMetadata(fakeFile("soft_static-final_mix.mp3"));
    expect(result.title).toBe("Soft Static Final Mix");
    expect(result.artist).toBe("Unknown Artist");
    expect(result.coverBlob).toBeUndefined();
  });

  it("handles a filename with no separators", async () => {
    const result = await extractMetadata(fakeFile("track1.mp3"));
    expect(result.title).toBe("Track1");
  });

  it("never throws even for completely invalid audio content", async () => {
    await expect(extractMetadata(fakeFile("weird name!!.mp3", ""))).resolves.toBeDefined();
  });
});
