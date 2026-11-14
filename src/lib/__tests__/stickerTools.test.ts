import { describe, expect, it } from "vitest";
import { contentBounds, eraseLine, floodErase, type Pixels } from "../stickerTools";

function make(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  }
  return { data, width, height };
}
const alpha = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

// 10x10 white background with a red 4x4 square in the middle.
const subject = () =>
  make(10, 10, (x, y) => (x >= 3 && x <= 6 && y >= 3 && y <= 6 ? [220, 30, 30, 255] : [250, 250, 250, 255]));

describe("floodErase", () => {
  it("clears the connected background and keeps the subject", () => {
    const img = subject();
    expect(floodErase(img, 0, 0, 10)).toBe(100 - 16);
    expect(alpha(img, 0, 0)).toBe(0);
    expect(alpha(img, 9, 9)).toBe(0);
    expect(alpha(img, 4, 4)).toBe(255);
  });

  it("respects tolerance: near-white is cleared, far colors are not", () => {
    const img = make(4, 1, (x) => (x < 2 ? [255, 255, 255, 255] : x === 2 ? [240, 240, 240, 255] : [0, 0, 0, 255]));
    floodErase(img, 0, 0, 8);
    expect([0, 1, 2, 3].map((x) => alpha(img, x, 0))).toEqual([0, 0, 0, 255]);
  });

  it("does not jump across a barrier of a different color", () => {
    // Left white | black wall | right white
    const img = make(5, 1, (x) => (x === 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    floodErase(img, 0, 0, 10);
    expect([0, 1, 2, 3, 4].map((x) => alpha(img, x, 0))).toEqual([0, 0, 255, 255, 255]);
  });

  it("walks through already transparent pixels", () => {
    const img = make(5, 1, (x) => (x === 2 ? [0, 0, 0, 0] : [255, 255, 255, 255]));
    floodErase(img, 0, 0, 10);
    expect(alpha(img, 4, 0)).toBe(0);
  });

  it("ignores clicks outside the image", () => {
    expect(floodErase(subject(), -1, 3, 50)).toBe(0);
  });
});

describe("eraseLine / contentBounds", () => {
  it("erases along a stroke and bounds shrink accordingly", () => {
    const img = make(20, 20, () => [10, 10, 10, 255]);
    expect(contentBounds(img)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    eraseLine(img, 0, 10, 19, 10, 2);
    expect(alpha(img, 10, 10)).toBe(0);
    expect(alpha(img, 10, 0)).toBe(255);
  });

  it("returns null when everything is transparent", () => {
    expect(contentBounds(make(3, 3, () => [0, 0, 0, 0]))).toBeNull();
    expect(contentBounds(subject())).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});
