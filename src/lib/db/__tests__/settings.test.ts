import { beforeEach, describe, expect, it } from "vitest";
import { resetFakeIndexedDB } from "./testUtils";
import {
  getSettings,
  incrementSongsPlayedCounter,
  loadPlaybackSnapshot,
  pushRecentlyPlayed,
  savePlaybackSnapshot,
  updateSettings,
} from "../settings";

beforeEach(() => {
  resetFakeIndexedDB();
});

describe("settings", () => {
  it("creates sane defaults on first access", async () => {
    const settings = await getSettings();
    expect(settings.theme).toBe("dark");
    expect(settings.adFrequency).toBe("off");
    expect(settings.playbackState).toBeNull();
    expect(settings.recentlyPlayed).toEqual([]);
  });

  it("caps recentlyPlayed at 8 and dedupes by playlist+song", async () => {
    for (let i = 0; i < 10; i++) {
      await pushRecentlyPlayed({ playlistId: "p1", songId: `s${i}` });
    }
    const settings = await getSettings();
    expect(settings.recentlyPlayed).toHaveLength(8);
    expect(settings.recentlyPlayed[0].songId).toBe("s9"); // most recent first

    await pushRecentlyPlayed({ playlistId: "p1", songId: "s9" });
    const after = await getSettings();
    expect(after.recentlyPlayed.filter((r) => r.songId === "s9")).toHaveLength(1);
    expect(after.recentlyPlayed[0].songId).toBe("s9");
  });

  it("increments the songs-played counter for the ad-frequency gate", async () => {
    expect(await incrementSongsPlayedCounter()).toBe(1);
    expect(await incrementSongsPlayedCounter()).toBe(2);
  });

  it("round-trips a playback snapshot for reload persistence", async () => {
    const snapshot = {
      currentPlaylistId: "pl1",
      currentSongId: "s1",
      queue: [{ playlistId: "pl1", songId: "s2" }],
      playHistory: [{ playlistId: "pl1", songId: "s0" }],
      progressSec: 42.5,
      shuffle: true,
      repeatMode: "all" as const,
    };
    await savePlaybackSnapshot(snapshot);
    expect(await loadPlaybackSnapshot()).toEqual(snapshot);

    await savePlaybackSnapshot(null);
    expect(await loadPlaybackSnapshot()).toBeNull();
  });

  it("updateSettings merges rather than replaces", async () => {
    await updateSettings({ volumeLevel: 33 });
    const settings = await getSettings();
    expect(settings.volumeLevel).toBe(33);
    expect(settings.theme).toBe("dark");
  });
});
