/** Reads a Blob's real playback duration via a temporary <audio> element —
 * never trusted from ID3 tags, which are frequently wrong or absent. Rejects
 * on unsupported/corrupt files or after an 8s timeout (some unsupported
 * formats never fire `error`, they just hang). */
export function getRealDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    let settled = false;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out reading audio duration — format may be unsupported."));
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      URL.revokeObjectURL(url);
    }

    function finish(duration: number) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(duration);
    }

    function onLoaded() {
      if (!Number.isFinite(audio.duration)) {
        // Chrome bug workaround: some streams report Infinity until a seek occurs.
        const onDurationChange = () => {
          audio.removeEventListener("durationchange", onDurationChange);
          finish(Number.isFinite(audio.duration) ? audio.duration : 0);
        };
        audio.addEventListener("durationchange", onDurationChange);
        audio.currentTime = 1e7;
        return;
      }
      finish(audio.duration);
    }

    function onError() {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Unsupported or corrupted audio file."));
    }

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = url;
  });
}
