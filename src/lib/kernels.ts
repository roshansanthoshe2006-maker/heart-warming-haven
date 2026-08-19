export type Kernel = {
  name: string;
  matrix: number[][];
  divisor?: number;
  description: string;
};

export const SPATIAL_KERNELS: Kernel[] = [
  {
    name: "Identity",
    matrix: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ],
    description: "Output equals input. The baseline convolution.",
  },
  {
    name: "Box Blur (Mean)",
    matrix: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    divisor: 9,
    description: "Averages the neighbourhood, smoothing noise and detail.",
  },
  {
    name: "Gaussian Blur",
    matrix: [
      [1, 2, 1],
      [2, 4, 2],
      [1, 2, 1],
    ],
    divisor: 16,
    description: "Weighted smoothing that preserves structure better than a mean filter.",
  },
  {
    name: "Sharpen",
    matrix: [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ],
    description: "Boosts the centre pixel against its neighbours to enhance edges.",
  },
  {
    name: "Laplacian",
    matrix: [
      [0, 1, 0],
      [1, -4, 1],
      [0, 1, 0],
    ],
    description: "Second derivative operator; responds to intensity discontinuities.",
  },
  {
    name: "Emboss",
    matrix: [
      [-2, -1, 0],
      [-1, 1, 1],
      [0, 1, 2],
    ],
    description: "Directional relief effect along the diagonal.",
  },
];

export const GRADIENT_KERNELS: Kernel[] = [
  {
    name: "Sobel X",
    matrix: [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ],
    description: "Horizontal gradient ∂I/∂x with smoothing in y.",
  },
  {
    name: "Sobel Y",
    matrix: [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ],
    description: "Vertical gradient ∂I/∂y with smoothing in x.",
  },
  {
    name: "Prewitt X",
    matrix: [
      [-1, 0, 1],
      [-1, 0, 1],
      [-1, 0, 1],
    ],
    description: "Horizontal difference operator with uniform averaging.",
  },
  {
    name: "Prewitt Y",
    matrix: [
      [-1, -1, -1],
      [0, 0, 0],
      [1, 1, 1],
    ],
    description: "Vertical difference operator with uniform averaging.",
  },
  {
    name: "Roberts Cross",
    matrix: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
    ],
    description: "Minimal 2×2 diagonal difference, embedded in a 3×3 window.",
  },
  {
    name: "Scharr X",
    matrix: [
      [-3, 0, 3],
      [-10, 0, 10],
      [-3, 0, 3],
    ],
    description: "Rotation-optimised horizontal gradient estimator.",
  },
];

export const CATEGORIES = {
  "Spatial Domain Methods": SPATIAL_KERNELS,
  "Gradient Operators": GRADIENT_KERNELS,
} as const;

export type CategoryName = keyof typeof CATEGORIES;

/** Grayscale pixel buffer */
export type Gray = { data: Float32Array; width: number; height: number };

export function convolve(src: Gray, kernel: Kernel, signed: boolean): Gray {
  const { width: w, height: h, data } = src;
  const out = new Float32Array(w * h);
  const div = kernel.divisor ?? 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const sx = Math.min(w - 1, Math.max(0, x + kx));
          const sy = Math.min(h - 1, Math.max(0, y + ky));
          sum += data[sy * w + sx]! * kernel.matrix[ky + 1]![kx + 1]!;
        }
      }
      sum /= div;
      out[y * w + x] = signed
        ? Math.min(255, Math.abs(sum))
        : Math.min(255, Math.max(0, sum));
    }
  }
  return { data: out, width: w, height: h };
}

export function neighbourhood(src: Gray, x: number, y: number): number[][] {
  const rows: number[][] = [];
  for (let ky = -1; ky <= 1; ky++) {
    const row: number[] = [];
    for (let kx = -1; kx <= 1; kx++) {
      const sx = Math.min(src.width - 1, Math.max(0, x + kx));
      const sy = Math.min(src.height - 1, Math.max(0, y + ky));
      row.push(Math.round(src.data[sy * src.width + sx]!));
    }
    rows.push(row);
  }
  return rows;
}

/** Procedurally generated demo scene (grayscale house + tree + sun). */
export function defaultScene(w = 160, h = 120): Gray {
  const d = new Float32Array(w * h);
  const set = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) d[y * w + x] = v;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) set(x, y, y > h * 0.62 ? 150 : 205);
  // hills
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (Math.abs(x - 52) + Math.abs(y - h * 0.62) < 42 && y < h * 0.62) set(x, y, 120);
  // sun
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if ((x - 122) ** 2 + (y - 28) ** 2 < 20 ** 2) set(x, y, 250);
  // house body
  for (let y = 52; y < 96; y++) for (let x = 54; x < 106; x++) set(x, y, 78);
  // roof
  for (let y = 26; y < 53; y++)
    for (let x = 44; x < 116; x++)
      if (Math.abs(x - 80) < (y - 26) * 1.35) set(x, y, 48);
  // windows + door
  for (let y = 62; y < 76; y++) for (let x = 62; x < 74; x++) set(x, y, 200);
  for (let y = 62; y < 76; y++) for (let x = 88; x < 100; x++) set(x, y, 200);
  for (let y = 70; y < 96; y++) for (let x = 76; x < 88; x++) set(x, y, 215);
  // tree
  for (let y = 60; y < 96; y++) for (let x = 22; x < 30; x++) set(x, y, 68);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if ((x - 26) ** 2 / 1.2 + (y - 48) ** 2 < 20 ** 2) set(x, y, 55);
  return { data: d, width: w, height: h };
}
