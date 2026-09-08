import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getAudioBlob, getSong, getSongsForPlaylist } from "@/lib/db/songs";
import {
  getSettings,
  incrementSongsPlayedCounter,
  loadPlaybackSnapshot,
  pushRecentlyPlayed,
  savePlaybackSnapshot,
  updateSettings,
} from "@/lib/db/settings";
import { buildQueue, decideNext, decidePrev, pushHistory } from "@/lib/playbackReducer";
import { fisherYatesShuffle } from "@/lib/shuffle";
import { useLocale } from "@/i18n/LocaleContext";
import type { AdFrequency, PlaybackSnapshot, QueueItem, RecentlyPlayedEntry, RepeatMode, SleepTimerOption } from "@/types";

interface AudioPlayerState {
  playingPlaylistId: string | null;
  playingSongId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  progressSec: number;
  durationSec: number;
  volumeLevel: number;
  playbackRate: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  queue: QueueItem[];
  playHistory: QueueItem[];
  recentlyPlayed: RecentlyPlayedEntry[];
  error: string | null;
  pendingAd: boolean;
  adFrequency: AdFrequency;
  sleepTimerOption: SleepTimerOption;
  sleepTimerEndsAt: number | null;
}

interface AudioPlayerActions {
  playPlaylist: (playlistId: string, startSongId?: string) => Promise<void>;
  shufflePlaylist: (playlistId: string) => Promise<void>;
  playSong: (playlistId: string, songId: string) => Promise<void>;
  togglePlayPause: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (sec: number) => void;
  seekByRatio: (ratio: number) => void;
  setVolume: (level: number) => void;
  setPlaybackRate: (rate: number) => void;
  setSleepTimer: (option: SleepTimerOption) => void;
  toggleShuffle: () => Promise<void>;
  cycleRepeat: () => void;
  addToQueue: (item: QueueItem) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  dismissAd: () => void;
  clearError: () => void;
  pruneReferences: (playlistId: string, songId?: string) => void;
  repointPlaylistReferences: (songId: string, fromPlaylistId: string, toPlaylistId: string) => void;
  setAdFrequency: (freq: AdFrequency) => void;
}

type AudioPlayerContextValue = AudioPlayerState & AudioPlayerActions;

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const initialState: AudioPlayerState = {
  playingPlaylistId: null,
  playingSongId: null,
  isPlaying: false,
  isLoading: false,
  progressSec: 0,
  durationSec: 0,
  volumeLevel: 70,
  playbackRate: 1,
  shuffle: false,
  repeatMode: "off",
  queue: [],
  playHistory: [],
  recentlyPlayed: [],
  error: null,
  pendingAd: false,
  adFrequency: "off",
  sleepTimerOption: "off",
  sleepTimerEndsAt: null,
};

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [state, setState] = useState<AudioPlayerState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  // The audio-element event wiring effect below only runs once on mount, so
  // it can't close over a fresh `t` after a language switch — this ref keeps
  // it current without needing to re-run that effect.
  const tRef = useRef(t);
  tRef.current = t;

  function patch(update: Partial<AudioPlayerState> | ((s: AudioPlayerState) => Partial<AudioPlayerState>)) {
    setState((current) => ({ ...current, ...(typeof update === "function" ? update(current) : update) }));
  }

  // Lazily create the single shared <audio> element once, via ref — a
  // module-level singleton would double-instantiate under React 18
  // StrictMode's dev double-invoke; a ref scoped to this provider's one
  // mount does not.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  if (!audioElRef.current) audioElRef.current = new Audio();

  const objectUrlRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearSleepTimer() {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
  }

  function revokeCurrentUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  async function saveSnapshotNow() {
    const s = stateRef.current;
    if (!s.playingPlaylistId || !s.playingSongId) {
      await savePlaybackSnapshot(null);
      return;
    }
    const snapshot: PlaybackSnapshot = {
      currentPlaylistId: s.playingPlaylistId,
      currentSongId: s.playingSongId,
      queue: s.queue,
      playHistory: s.playHistory,
      progressSec: s.progressSec,
      shuffle: s.shuffle,
      repeatMode: s.repeatMode,
    };
    await savePlaybackSnapshot(snapshot);
  }

  function scheduleSnapshotSave() {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => void saveSnapshotNow(), 5000);
  }

  /** Loads a song's audio blob into the shared <audio> element and (usually)
   * plays it. Does not decide queue/history transitions — see switchToSong. */
  async function loadAndPlay(
    songId: string,
    opts: { seekTo?: number; attemptAutoplay?: boolean; countAsPlay?: boolean } = {}
  ) {
    const audio = audioElRef.current!;
    const song = await getSong(songId);
    const blob = await getAudioBlob(songId);
    if (!song || !blob) {
      patch({ error: t("errors.songNotFound") });
      return;
    }

    revokeCurrentUrl();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    pendingSeekRef.current = opts.seekTo ?? null;
    audio.src = url;
    audio.playbackRate = stateRef.current.playbackRate;
    audio.load();

    patch({
      isLoading: true,
      progressSec: opts.seekTo ?? 0,
      durationSec: song.durationSec,
      error: null,
    });

    if (opts.attemptAutoplay ?? true) {
      try {
        await audio.play();
        patch({ isPlaying: true });
      } catch {
        // Autoplay rejected (no recent user gesture — typically when
        // restoring a session after a page reload). Fall back to paused at
        // the correct position rather than throwing or losing the spot.
        patch({ isPlaying: false });
      }
    } else {
      patch({ isPlaying: false });
    }

    if (opts.countAsPlay ?? true) {
      await pushRecentlyPlayed({ playlistId: song.playlistId, songId });
      const settings = await getSettings();
      const counter = await incrementSongsPlayedCounter();
      patch({ recentlyPlayed: settings.recentlyPlayed });
      const freq = stateRef.current.adFrequency;
      if (freq !== "off" && counter % freq === 0) {
        patch({ pendingAd: true });
      }
    }
  }

  /** Switches to a new "current song", handling the play-history push. Every
   * genuinely new song transition (direct click, next(), shuffle pick) pushes
   * the outgoing song onto playHistory — except prev(), which itself
   * *consumes* history and must not re-add to it. */
  async function switchToSong(
    playlistId: string,
    songId: string,
    options: { pushOutgoingToHistory: boolean; seekTo?: number; attemptAutoplay?: boolean; countAsPlay?: boolean }
  ) {
    const s = stateRef.current;
    const outgoing = s.playingPlaylistId && s.playingSongId ? { playlistId: s.playingPlaylistId, songId: s.playingSongId } : null;

    await loadAndPlay(songId, { seekTo: options.seekTo, attemptAutoplay: options.attemptAutoplay, countAsPlay: options.countAsPlay });
    patch({ playingPlaylistId: playlistId, playingSongId: songId });

    if (options.pushOutgoingToHistory && outgoing && !(outgoing.playlistId === playlistId && outgoing.songId === songId)) {
      patch((current) => ({ playHistory: pushHistory(current.playHistory, outgoing) }));
    }
  }

  async function playSong(playlistId: string, songId: string) {
    const orderedSongs = await getSongsForPlaylist(playlistId);
    const queue = buildQueue(orderedSongs, songId, stateRef.current.shuffle, playlistId);
    await switchToSong(playlistId, songId, { pushOutgoingToHistory: true });
    patch({ queue });
  }

  async function playPlaylist(playlistId: string, startSongId?: string) {
    const orderedSongs = await getSongsForPlaylist(playlistId);
    if (orderedSongs.length === 0) return;
    const start = startSongId ?? orderedSongs[0].id;
    await playSong(playlistId, start);
  }

  /** The "Shuffle" button on a playlist: forces shuffle on (not just picks a
   * random song) and starts from a random track with the rest of the
   * playlist mixed into the queue. */
  async function shufflePlaylist(playlistId: string) {
    const orderedSongs = await getSongsForPlaylist(playlistId);
    if (orderedSongs.length === 0) return;
    const randomSong = orderedSongs[Math.floor(Math.random() * orderedSongs.length)];
    const queue = buildQueue(orderedSongs, randomSong.id, true, playlistId);
    patch({ shuffle: true });
    await switchToSong(playlistId, randomSong.id, { pushOutgoingToHistory: true });
    patch({ queue });
  }

  async function next(opts: { fromEnded?: boolean } = {}) {
    const s = stateRef.current;
    const orderedSongsInCurrentPlaylist = s.playingPlaylistId ? await getSongsForPlaylist(s.playingPlaylistId) : [];
    const decision = decideNext({
      queue: s.queue,
      repeatMode: s.repeatMode,
      playingPlaylistId: s.playingPlaylistId,
      orderedSongsInCurrentPlaylist,
      fromEnded: opts.fromEnded ?? false,
    });

    if (decision.action === "play") {
      await switchToSong(decision.item.playlistId, decision.item.songId, { pushOutgoingToHistory: true });
      patch({ queue: decision.remainingQueue });
    } else if (decision.action === "restart-same") {
      const audio = audioElRef.current!;
      audio.currentTime = 0;
      try {
        await audio.play();
        patch({ isPlaying: true });
      } catch {
        patch({ isPlaying: false });
      }
    } else if (decision.action === "restart-playlist") {
      await switchToSong(decision.item.playlistId, decision.item.songId, { pushOutgoingToHistory: true, seekTo: 0 });
      patch({ queue: decision.queue });
    } else {
      audioElRef.current!.pause();
      patch({ isPlaying: false });
    }
  }

  async function prev() {
    const decision = decidePrev(stateRef.current.playHistory);
    if (decision.action === "noop") return;
    await switchToSong(decision.item.playlistId, decision.item.songId, { pushOutgoingToHistory: false });
    patch({ playHistory: decision.remainingHistory });
  }

  function togglePlayPause() {
    const audio = audioElRef.current!;
    if (!stateRef.current.playingSongId) return;
    if (stateRef.current.isPlaying) {
      audio.pause();
    } else {
      void audio.play().then(
        () => patch({ isPlaying: true }),
        () => patch({ isPlaying: false })
      );
    }
  }

  function seek(sec: number) {
    const audio = audioElRef.current!;
    audio.currentTime = sec;
    patch({ progressSec: sec });
  }

  function seekByRatio(ratio: number) {
    const clamped = Math.min(1, Math.max(0, ratio));
    seek(clamped * stateRef.current.durationSec);
  }

  function setVolume(level: number) {
    const clamped = Math.min(100, Math.max(0, level));
    audioElRef.current!.volume = clamped / 100;
    patch({ volumeLevel: clamped });
    if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current);
    volumeDebounceRef.current = setTimeout(() => void updateSettings({ volumeLevel: clamped }), 400);
  }

  function setPlaybackRate(rate: number) {
    audioElRef.current!.playbackRate = rate;
    patch({ playbackRate: rate });
    void updateSettings({ playbackRate: rate });
  }

  /** 15/30/60 schedules a real timeout that pauses playback when it fires.
   * "end-of-track" is handled specially in the `ended` listener below —
   * it pauses at the natural end of the current song instead of on a timer. */
  function setSleepTimer(option: SleepTimerOption) {
    clearSleepTimer();
    if (option === "off") {
      patch({ sleepTimerOption: "off", sleepTimerEndsAt: null });
      return;
    }
    if (option === "end-of-track") {
      patch({ sleepTimerOption: "end-of-track", sleepTimerEndsAt: null });
      return;
    }
    const endsAt = Date.now() + option * 60_000;
    patch({ sleepTimerOption: option, sleepTimerEndsAt: endsAt });
    sleepTimerRef.current = setTimeout(() => {
      audioElRef.current?.pause();
      patch({ sleepTimerOption: "off", sleepTimerEndsAt: null });
    }, option * 60_000);
  }

  /** Toggling shuffle mid-playback must actually reorder what's left to play,
   * not just flip a flag nothing reads afterward — turning it on shuffles the
   * remaining queue in place, turning it off restores the playlist's real
   * order for whatever's still left in it. */
  async function toggleShuffle() {
    const s = stateRef.current;
    const next = !s.shuffle;

    if (s.queue.length === 0 || !s.playingPlaylistId) {
      patch({ shuffle: next });
      return;
    }

    if (next) {
      patch({ shuffle: true, queue: fisherYatesShuffle(s.queue) });
      return;
    }

    const playlistId = s.playingPlaylistId;
    const orderedSongs = await getSongsForPlaylist(playlistId);
    const queuedIds = new Set(s.queue.map((item) => item.songId));
    const restoredQueue = orderedSongs
      .filter((song) => queuedIds.has(song.id))
      .map((song) => ({ playlistId, songId: song.id }));
    patch({ shuffle: false, queue: restoredQueue });
  }

  function cycleRepeat() {
    patch((s) => ({
      repeatMode: s.repeatMode === "off" ? "all" : s.repeatMode === "all" ? "one" : "off",
    }));
  }

  function addToQueue(item: QueueItem) {
    patch((s) => ({ queue: [...s.queue, item] }));
  }

  function removeFromQueue(index: number) {
    patch((s) => ({ queue: s.queue.filter((_, i) => i !== index) }));
  }

  function reorderQueue(fromIndex: number, toIndex: number) {
    patch((s) => {
      const next = [...s.queue];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { queue: next };
    });
  }

  function dismissAd() {
    patch({ pendingAd: false });
  }

  function clearError() {
    patch({ error: null });
  }

  function setAdFrequency(freq: AdFrequency) {
    patch({ adFrequency: freq });
    void updateSettings({ adFrequency: freq });
  }

  /** Called by LibraryContext when a song/playlist is deleted, so the
   * queue/history/recently-played never hold a dangling reference, and
   * playback stops cleanly if the deleted item was the one currently
   * playing (rather than crashing on a lookup of a now-missing song). */
  function pruneReferences(playlistId: string, songId?: string) {
    const matches = (item: QueueItem) => item.playlistId === playlistId && (songId === undefined || item.songId === songId);

    const s = stateRef.current;
    const isCurrentAffected = Boolean(
      s.playingPlaylistId === playlistId && (songId === undefined || s.playingSongId === songId)
    );

    patch((current) => ({
      queue: current.queue.filter((i) => !matches(i)),
      playHistory: current.playHistory.filter((i) => !matches(i)),
      recentlyPlayed: current.recentlyPlayed.filter((r) => !matches(r)),
    }));
    void updateSettings({ recentlyPlayed: stateRef.current.recentlyPlayed.filter((r) => !matches(r)) });

    if (isCurrentAffected) {
      const audio = audioElRef.current!;
      audio.pause();
      revokeCurrentUrl();
      audio.removeAttribute("src");
      patch({
        playingPlaylistId: null,
        playingSongId: null,
        isPlaying: false,
        progressSec: 0,
        durationSec: 0,
      });
      void savePlaybackSnapshot(null);
    }
  }

  /** Called by LibraryContext when a song is moved to a different playlist —
   * unlike pruneReferences, the song still exists, so this repoints any
   * queue/history/recently-played/now-playing reference to the new
   * playlistId instead of removing it (playback of that song, if it's the
   * one currently playing, is left running uninterrupted). */
  function repointPlaylistReferences(songId: string, fromPlaylistId: string, toPlaylistId: string) {
    const remap = (item: QueueItem): QueueItem =>
      item.playlistId === fromPlaylistId && item.songId === songId ? { ...item, playlistId: toPlaylistId } : item;

    patch((current) => ({
      queue: current.queue.map(remap),
      playHistory: current.playHistory.map(remap),
      recentlyPlayed: current.recentlyPlayed.map((r) =>
        r.playlistId === fromPlaylistId && r.songId === songId ? { ...r, playlistId: toPlaylistId } : r
      ),
      playingPlaylistId:
        current.playingPlaylistId === fromPlaylistId && current.playingSongId === songId
          ? toPlaylistId
          : current.playingPlaylistId,
    }));
  }

  // ---- one-time <audio> element event wiring ----
  useEffect(() => {
    const audio = audioElRef.current!;

    function handleTimeUpdate() {
      patch({ progressSec: audio.currentTime });
      scheduleSnapshotSave();
    }

    function handleLoadedMetadata() {
      if (!Number.isFinite(audio.duration)) {
        // Chrome bug workaround: some streams report Infinity until a seek occurs.
        const onDurationChange = () => {
          audio.currentTime = pendingSeekRef.current ?? 0;
          pendingSeekRef.current = null;
          audio.removeEventListener("durationchange", onDurationChange);
          if (Number.isFinite(audio.duration)) patch({ durationSec: audio.duration });
        };
        audio.addEventListener("durationchange", onDurationChange);
        audio.currentTime = 1e7;
        return;
      }
      patch({ durationSec: audio.duration });
      if (pendingSeekRef.current != null) {
        audio.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
    }

    function handleEnded() {
      if (stateRef.current.sleepTimerOption === "end-of-track") {
        clearSleepTimer();
        patch({ sleepTimerOption: "off", sleepTimerEndsAt: null, isPlaying: false });
        return;
      }
      void next({ fromEnded: true });
    }

    function handleError() {
      patch({ error: tRef.current("errors.playbackError"), isLoading: false });
      setTimeout(() => void next(), 800);
    }

    function handleWaiting() {
      patch({ isLoading: true });
    }
    function handleCanPlay() {
      patch({ isLoading: false });
    }
    function handlePause() {
      patch({ isPlaying: false });
      void saveSnapshotNow();
    }
    // Hardware media keys (headphones, Bluetooth controls, OS lock-screen)
    // call audio.play()/pause() directly without going through
    // togglePlayPause() — without this listener, isPlaying (and the button
    // icon) never finds out playback actually resumed.
    function handlePlay() {
      patch({ isPlaying: true });
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-once; all handlers read live values via stateRef/refs, never stale render-scoped state.
  }, []);

  // ---- MediaSession: hardware media keys (headphones, Bluetooth, lock screen) ----
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => void audioElRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioElRef.current?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => void prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => void next());

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-once; prev/next read live values via stateRef/refs.
  }, []);

  // Keeps the lock-screen/headset "now playing" info and play/pause
  // indicator in sync with the actual current song and playback state.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const songId = state.playingSongId;
    if (!songId) {
      navigator.mediaSession.metadata = null;
      return;
    }
    void getSong(songId).then((song) => {
      if (!song) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist });
    });
  }, [state.playingSongId]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = state.isPlaying ? "playing" : "paused";
  }, [state.isPlaying]);

  // ---- hydrate settings + any persisted playback session on mount ----
  useEffect(() => {
    void (async () => {
      const settings = await getSettings();
      audioElRef.current!.volume = settings.volumeLevel / 100;
      audioElRef.current!.playbackRate = settings.playbackRate;
      patch({
        volumeLevel: settings.volumeLevel,
        playbackRate: settings.playbackRate,
        adFrequency: settings.adFrequency,
        recentlyPlayed: settings.recentlyPlayed,
      });

      const snapshot = await loadPlaybackSnapshot();
      if (!snapshot) return;
      patch({
        queue: snapshot.queue,
        playHistory: snapshot.playHistory,
        shuffle: snapshot.shuffle,
        repeatMode: snapshot.repeatMode,
        playingPlaylistId: snapshot.currentPlaylistId,
        playingSongId: snapshot.currentSongId,
      });
      await loadAndPlay(snapshot.currentSongId, { seekTo: snapshot.progressSec, attemptAutoplay: true, countAsPlay: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only.
  }, []);

  useEffect(() => clearSleepTimer, []);

  const value: AudioPlayerContextValue = {
    ...state,
    playPlaylist,
    shufflePlaylist,
    playSong,
    togglePlayPause,
    next,
    prev,
    seek,
    seekByRatio,
    setVolume,
    setPlaybackRate,
    setSleepTimer,
    toggleShuffle,
    cycleRepeat,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    dismissAd,
    clearError,
    pruneReferences,
    repointPlaylistReferences,
    setAdFrequency,
  };

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  return ctx;
}
