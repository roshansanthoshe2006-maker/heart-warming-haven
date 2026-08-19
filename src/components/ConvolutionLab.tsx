import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  convolve,
  defaultScene,
  neighbourhood,
  type CategoryName,
  type Gray,
  type Kernel,
} from "@/lib/kernels";

const SCALE = 4;

function grayToCanvas(canvas: HTMLCanvasElement, img: Gray) {
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const id = ctx.createImageData(img.width, img.height);
  for (let i = 0; i < img.width * img.height; i++) {
    const v = Math.round(img.data[i]!);
    id.data[i * 4] = v;
    id.data[i * 4 + 1] = v;
    id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

function Matrix({
  values,
  highlight,
  format = (n: number) => String(n),
  tone = "neutral",
}: {
  values: number[][];
  highlight?: boolean;
  format?: (n: number) => string;
  tone?: "neutral" | "accent";
}) {
  const flat = values.flat();
  const max = Math.max(...flat.map(Math.abs), 1);
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/60 p-1">
      {values.map((row, y) =>
        row.map((v, x) => {
          const intensity = Math.abs(v) / max;
          const isCenter = highlight && x === 1 && y === 1;
          return (
            <div
              key={`${x}-${y}`}
              className={`flex h-11 items-center justify-center rounded-sm border text-sm tabular-nums transition-colors ${
                isCenter
                  ? "border-primary font-semibold text-primary-foreground"
                  : "border-border/60 text-foreground"
              }`}
              style={{
                backgroundColor: isCenter
                  ? "var(--primary)"
                  : tone === "accent"
                    ? `color-mix(in oklab, var(--chart-1) ${intensity * 45}%, var(--card))`
                    : `color-mix(in oklab, var(--foreground) ${intensity * 12}%, var(--card))`,
              }}
            >
              {format(v)}
            </div>
          );
        }),
      )}
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      <header className="flex items-baseline gap-3 border-b border-border px-5 py-3">
        {eyebrow ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function ConvolutionLab() {
  const [category, setCategory] = useState<CategoryName>("Spatial Domain Methods");
  const [kernelName, setKernelName] = useState("Identity");
  const [source, setSource] = useState<Gray>(() => defaultScene());
  const [sourceLabel, setSourceLabel] = useState("Default scene");
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const kernels = CATEGORIES[category];
  const kernel: Kernel =
    kernels.find((k) => k.name === kernelName) ?? (kernels[0] as Kernel);

  const signed = category === "Gradient Operators";
  const output = useMemo(() => convolve(source, kernel, signed), [source, kernel, signed]);

  const inRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (inRef.current) grayToCanvas(inRef.current, source);
  }, [source]);
  useEffect(() => {
    if (outRef.current) grayToCanvas(outRef.current, output);
  }, [output]);

  const probe = cursor ?? {
    x: Math.floor(source.width / 2),
    y: Math.floor(source.height / 2),
  };
  const patch = neighbourhood(source, probe.x, probe.y);
  const div = kernel.divisor ?? 1;
  const products = patch.map((row, y) =>
    row.map((v, x) => (v * kernel.matrix[y]![x]!) / div),
  );
  const sum = products.flat().reduce((a, b) => a + b, 0);
  const result = signed
    ? Math.min(255, Math.abs(sum))
    : Math.min(255, Math.max(0, sum));

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * source.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * source.height);
    setCursor({ x, y });
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 220 / Math.max(img.width, img.height));
      const w = Math.max(8, Math.round(img.width * scale));
      const h = Math.max(8, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++)
        gray[i] =
          0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
      setSource({ data: gray, width: w, height: h });
      setSourceLabel(file.name);
      setCursor(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const formula = patch
    .map((row, y) =>
      row
        .map((v, x) => `(${v} × ${(kernel.matrix[y]![x]! / div).toFixed(2)})`)
        .join(" + "),
    )
    .join(" + ");

  const selectClass =
    "w-full appearance-none rounded-md border border-border bg-background px-3 py-2 text-sm font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-10">
      <header className="border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          Digital Image Processing / Lab 01
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Convolution Kernel Explorer
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Move the cursor over the input image to watch a 3 × 3 neighbourhood run
          through the selected kernel, term by term.
        </p>
      </header>

      <Panel title="Select image processing operation" eyebrow="01">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Processing category
            </span>
            <select
              className={selectClass}
              value={category}
              onChange={(e) => {
                const next = e.target.value as CategoryName;
                setCategory(next);
                setKernelName(CATEGORIES[next][0]!.name);
              }}
            >
              {Object.keys(CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Method</span>
            <select
              className={selectClass}
              value={kernel.name}
              onChange={(e) => setKernelName(e.target.value)}
            >
              {kernels.map((k) => (
                <option key={k.name} value={k.name}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Input image
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/bmp"
              onChange={handleUpload}
              className="w-full cursor-pointer rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:text-primary-foreground"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[auto_1fr]">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Kernel {kernel.divisor ? `(÷ ${kernel.divisor})` : ""}
            </p>
            <Matrix values={kernel.matrix} tone="accent" />
          </div>
          <div className="flex flex-col justify-center gap-3">
            <p className="text-sm text-muted-foreground">{kernel.description}</p>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {[
                ["Width", `${source.width} px`],
                ["Height", `${source.height} px`],
                ["Channels", "Grayscale"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border px-3 py-2">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Source: {sourceLabel} • border handling: edge clamp
            </p>
          </div>
        </div>
      </Panel>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              02
            </span>
            <h2 className="text-sm font-semibold tracking-tight">
              Input → Output comparison
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border p-0.5">
              {(Object.keys(SAMPLES) as SampleName[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSource(SAMPLES[name]());
                    setSourceLabel(name);
                    setCursor(null);
                  }}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    sourceLabel === name
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={downloadOutput}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Download output
            </button>
          </div>
        </header>

        <div className="grid gap-px bg-border md:grid-cols-2">
          <figure className="bg-card p-5">
            <figcaption className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Input
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {sourceLabel} · {source.width}×{source.height}
              </span>
            </figcaption>
            <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
              <canvas
                ref={inRef}
                onMouseMove={handleMove}
                onMouseLeave={() => setCursor(null)}
                style={{
                  imageRendering: "pixelated",
                  aspectRatio: `${source.width}/${source.height}`,
                }}
                className="block w-full cursor-crosshair"
              />
              <div
                className="pointer-events-none absolute rounded-[2px] border-2 border-primary shadow-[0_0_0_9999px_color-mix(in_oklab,var(--background)_35%,transparent)]"
                style={{
                  left: `${((probe.x - 1) / source.width) * 100}%`,
                  top: `${((probe.y - 1) / source.height) * 100}%`,
                  width: `${(3 / source.width) * 100}%`,
                  height: `${(3 / source.height) * 100}%`,
                }}
              />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              cursor → column {probe.x}, row {probe.y}
              {cursor ? "" : "  (idle: image centre)"}
            </p>
          </figure>

          <figure className="bg-card p-5">
            <figcaption className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Output
              </span>
              <span className="font-mono text-[11px] text-primary">{kernel.name}</span>
            </figcaption>
            <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
              <canvas
                ref={outRef}
                style={{
                  imageRendering: "pixelated",
                  aspectRatio: `${source.width}/${source.height}`,
                }}
                className="block w-full"
              />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              {signed ? "|response| clamped to [0, 255]" : "response clamped to [0, 255]"}
            </p>
          </figure>
        </div>
      </section>


      <Panel title="Live kernel calculation" eyebrow="04">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr_1fr]">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              ① Selected pixels
            </p>
            <Matrix values={patch} highlight />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              ② Pixel × kernel
            </p>
            <Matrix
              values={products}
              tone="accent"
              format={(n) => (Math.abs(n) < 0.005 ? "0" : n.toFixed(1))}
            />
          </div>
          <div className="flex flex-col justify-center gap-4 rounded-lg border border-border bg-muted/40 p-5 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Sum
              </p>
              <p className="text-2xl font-semibold tabular-nums">{sum.toFixed(2)}</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Output pixel
              </p>
              <p className="text-2xl font-semibold tabular-nums text-primary">
                {Math.round(result)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live formula</p>
          <p className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
            {formula} = {sum.toFixed(2)} → {Math.round(result)}
          </p>
        </div>
      </Panel>
    </div>
  );
}
