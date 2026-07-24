import type { MetadataRoute } from "next";

// PWA マニフェスト（Next.js App Router 規約）。
// Next が自動で <link rel="manifest" href="/manifest.webmanifest"> を挿入する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "撮るほど",
    short_name: "撮るほど",
    description:
      "かざすと、やさしく教えてくれる。石碑・案内板を撮影してAIがやさしく解説。",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F1E5",
    theme_color: "#B9502F",
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
