import { resizeToSquareJpeg } from "./resizeImage";

export type ProfileImageSlot = "avatar" | "banner" | "nameplate" | "cardBg";

/** Must match IMAGE_SLOTS in convex/users.ts. */
export const PROFILE_IMAGE_MAX_BYTES: Record<ProfileImageSlot, number> = {
  avatar: 4 * 1024 * 1024,
  banner: 8 * 1024 * 1024,
  nameplate: 4 * 1024 * 1024,
  cardBg: 8 * 1024 * 1024,
};

// Longest side for still images (photos are shrunk to this before upload).
const MAX_SIDE: Record<ProfileImageSlot, number> = { avatar: 256, banner: 1200, nameplate: 900, cardBg: 900 };

export class ImageTooBigError extends Error {}

async function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality)
  );
}

async function scaled(file: Blob, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await toBlob(canvas, "image/jpeg", 0.86);
}

/** What to upload for a picked file: an animated GIF goes up untouched plus
 * a still of its first frame; any other image is shrunk to one JPEG. */
export async function prepareProfileImage(file: File, slot: ProfileImageSlot): Promise<{ main: Blob; still?: Blob }> {
  if (file.type === "image/gif") {
    if (file.size > PROFILE_IMAGE_MAX_BYTES[slot]) throw new ImageTooBigError();
    // createImageBitmap decodes only the first frame of a GIF.
    const still = slot === "avatar" ? await resizeToSquareJpeg(file, 256) : await scaled(file, MAX_SIDE[slot]);
    return { main: file, still };
  }
  const main = slot === "avatar" ? await resizeToSquareJpeg(file, 256) : await scaled(file, MAX_SIDE[slot]);
  return { main };
}

export async function uploadBlob(uploadUrl: string, blob: Blob): Promise<string> {
  const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return ((await res.json()) as { storageId: string }).storageId;
}
