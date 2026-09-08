import { beforeEach, describe, expect, it } from "vitest";
import { resetFakeIndexedDB } from "./testUtils";
import { getDB } from "../index";
import { SETTINGS_ID } from "../schema";
import {
  detectDefaultLocale,
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
    expect(settings.playbackRate).toBe(1);
    expect(["en", "es"]).toContain(settings.locale);
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

  it("backfills defaults for fields missing from a pre-existing row (e.g. a real v1 settings record)", async () => {
    const db = await getDB();
    // Simulate a settings row saved before `locale`/`playbackRate` existed —
    // IndexedDB never retrofits old rows with new fields on its own.
    await db.put("settings", {
      id: SETTINGS_ID,
      theme: "dark",
      volumeLevel: 50,
      adFrequency: "off",
      songsPlayedCounter: 3,
      recentlyPlayed: [],
      playbackState: null,
      // locale and playbackRate intentionally absent
    } as never);

    const settings = await getSettings();
    expect(["en", "es"]).toContain(settings.locale);
    expect(settings.playbackRate).toBe(1);
    expect(settings.songsPlayedCounter).toBe(3); // pre-existing data preserved

    // The backfill should have been persisted, not just returned once.
    const reloaded = await db.get("settings", SETTINGS_ID);
    expect(reloaded?.locale).toBeDefined();
    expect(reloaded?.playbackRate).toBe(1);
  });
});

describe("detectDefaultLocale", () => {
  it("picks 'es' when navigator.language starts with es", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "es-MX", configurable: true });
    expect(detectDefaultLocale()).toBe("es");
    Object.defineProperty(navigator, "language", { value: original, configurable: true });
  });

  it("picks 'en' for any non-Spanish language", () => {
    const original = navigator.language;
    Object.defineProperty(navigator, "language", { value: "fr-FR", configurable: true });
    expect(detectDefaultLocale()).toBe("en");
    Object.defineProperty(navigator, "language", { value: original, configurable: true });
  });
});
