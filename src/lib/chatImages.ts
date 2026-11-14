const MAX_SIDE = 1600;
export const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024;

/** A photo ready to send: GIFs go as they are (to keep the animation),
 * other images are shrunk to at most 1600 px as JPEG. */
export async function prepareChatImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (file.type === "image/gif") {
    bitmap.close();
    if (file.size > MAX_CHAT_IMAGE_BYTES) throw new Error("TOO_BIG");
    return { blob: file, width, height };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.85)
  );
  return { blob, width: canvas.width, height: canvas.height };
}
