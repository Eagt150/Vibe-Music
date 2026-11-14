import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_VOICE_MS = 60_000;

// First format the browser can record: Opus in WebM (Chrome, Firefox),
// AAC in MP4 (Safari).
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type RecorderState = "idle" | "recording";

/** Records a voice note with the browser's MediaRecorder, stopping by
 * itself at one minute. `stop(true)` hands the recording to `onDone`;
 * `stop(false)` throws it away. */
export function useVoiceRecorder(onDone: (blob: Blob, durationMs: number) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<"denied" | "unsupported" | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const keepRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setState("idle");
    setElapsedMs(0);
  }, []);

  const stop = useCallback((keep: boolean) => {
    keepRef.current = keep;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("denied");
      return;
    }
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    keepRef.current = true;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(Date.now() - startedAtRef.current, MAX_VOICE_MS);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const keep = keepRef.current;
      cleanup();
      if (keep && blob.size > 0 && durationMs >= 500) onDoneRef.current(blob, durationMs);
    };
    startedAtRef.current = Date.now();
    recorder.start(250);
    setState("recording");
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_VOICE_MS) stop(true);
    }, 200);
  }, [cleanup, stop]);

  // Leaving the chat mid-recording discards it and releases the microphone.
  useEffect(() => () => {
    keepRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { state, elapsedMs, error, start, stop };
}
