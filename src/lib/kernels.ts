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

function makeGray(w: number, h: number, fn: (x: number, y: number) => number): Gray {
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      d[y * w + x] = Math.min(255, Math.max(0, fn(x, y)));
  return { data: d, width: w, height: h };
}

/** Soft photographic-style subject: sphere with shading, gradient sky, ground texture. */
export function sampleStudio(w = 176, h = 132): Gray {
  return makeGray(w, h, (x, y) => {
    const horizon = h * 0.68;
    let v = y < horizon ? 210 - (y / horizon) * 55 : 128 + Math.sin(x * 0.35 + y * 0.6) * 6;
    if (y >= horizon) v -= (y - horizon) * 0.5;
    // sphere
    const cx = w * 0.58, cy = horizon - 26, r = 30;
    const dx = (x - cx) / r, dy = (y - cy) / r;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1) {
      const nz = Math.sqrt(1 - d2);
      const light = 0.55 * -dx + 0.5 * -dy + 0.75 * nz;
      v = 40 + 205 * Math.max(0, light) ** 1.4;
    }
    // soft shadow
    const sx = (x - cx - 8) / 40, sy = (y - horizon - 5) / 8;
    if (sx * sx + sy * sy < 1) v *= 0.72;
    // small cube
    if (x > 24 && x < 62 && y > horizon - 30 && y < horizon) v = x < 44 ? 92 : 140;
    return v;
  });
}

/** Resolution test chart: bars, checkers, step wedge, circle. */
export function sampleTestChart(w = 176, h = 132): Gray {
  return makeGray(w, h, (x, y) => {
    if (y < h * 0.3) return Math.floor(x / 6) % 2 === 0 ? 235 : 30;
    if (y < h * 0.55)
      return (Math.floor(x / 8) + Math.floor((y - h * 0.3) / 8)) % 2 === 0 ? 220 : 45;
    if (y < h * 0.78) return 15 + Math.floor((x / w) * 8) * 32;
    const dx = x - w * 0.5, dy = y - h * 0.9;
    return dx * dx + dy * dy < 22 * 22 ? 240 : 70;
  });
}

/** Fine-grain noisy texture: good for smoothing/median demos. */
export function sampleTexture(w = 176, h = 132): Gray {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const noise = Array.from({ length: w * h }, () => rnd());
  return makeGray(w, h, (x, y) => {
    const base =
      140 +
      45 * Math.sin(x * 0.09) * Math.cos(y * 0.11) +
      25 * Math.sin((x + y) * 0.21);
    const salt = noise[y * w + x]!;
    if (salt > 0.985) return 255;
    if (salt < 0.015) return 0;
    return base + (salt - 0.5) * 40;
  });
}

export const SAMPLES = {
  "Studio subject": sampleStudio,
  "Resolution chart": sampleTestChart,
  "Noisy texture": sampleTexture,
} as const;

export type SampleName = keyof typeof SAMPLES;

/** Default demo image. */
export function defaultScene(): Gray {
  return sampleStudio();
}

