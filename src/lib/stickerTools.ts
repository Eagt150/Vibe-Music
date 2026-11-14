// Pixel tools for the sticker editor. Plain code over RGBA buffers — no
// external services or models, everything runs in the browser.

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** "Magic wand": makes transparent every pixel connected to (x, y) whose
 * color is within `tolerance` (0–100) of the clicked pixel. Pixels that are
 * already transparent are walked through, so one click can clear a
 * background that a previous click split in two. Returns how many pixels
 * were cleared. */
export function floodErase(img: Pixels, x: number, y: number, tolerance: number): number {
  const { data, width, height } = img;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return 0;

  const start = (y * width + x) * 4;
  const [r0, g0, b0] = [data[start], data[start + 1], data[start + 2]];
  // Max distance in RGB space is ~441; map 0–100 onto it.
  const maxDist = (Math.max(0, Math.min(100, tolerance)) / 100) * 441.7;
  const maxDistSq = maxDist * maxDist;

  const visited = new Uint8Array(width * height);
  const stack = [y * width + x];
  let cleared = 0;

  while (stack.length > 0) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    const transparent = data[i + 3] === 0;
    if (!transparent) {
      const dr = data[i] - r0;
      const dg = data[i + 1] - g0;
      const db = data[i + 2] - b0;
      if (dr * dr + dg * dg + db * db > maxDistSq) continue;
      data[i + 3] = 0;
      cleared++;
    }
    const px = p % width;
    const py = (p - px) / width;
    if (px > 0) stack.push(p - 1);
    if (px < width - 1) stack.push(p + 1);
    if (py > 0) stack.push(p - width);
    if (py < height - 1) stack.push(p + width);
  }
  return cleared;
}

/** Clears a round brush stroke from (x0, y0) to (x1, y1). */
export function eraseLine(img: Pixels, x0: number, y0: number, x1: number, y1: number, radius: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, radius / 2)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    eraseCircle(img, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius);
  }
}

function eraseCircle(img: Pixels, cx: number, cy: number, radius: number) {
  const { data, width, height } = img;
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

/** Bounding box of the non-transparent pixels, or null if all are clear. */
export function contentBounds(img: Pixels): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = img;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
