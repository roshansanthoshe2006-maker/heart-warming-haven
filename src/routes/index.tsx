import { createFileRoute } from "@tanstack/react-router";
import { ConvolutionLab } from "@/components/ConvolutionLab";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Convolution Kernel Explorer — Interactive Image Filters" },
      {
        name: "description",
        content:
          "Interactive 3×3 convolution playground: pick spatial or gradient kernels, hover the image and watch each multiply-accumulate step in real time.",
      },
      { property: "og:title", content: "Convolution Kernel Explorer" },
      {
        property: "og:description",
        content:
          "Explore blur, sharpen, Laplacian, Sobel and Prewitt kernels with a live 3×3 calculation view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ConvolutionLab />
    </main>
  );
}
