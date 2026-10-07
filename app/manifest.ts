import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mate Finder",
    short_name: "Mate Finder",
    description: "Buscá, compará y guardá mates de tiendas argentinas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f2eb",
    theme_color: "#173b2e",
    lang: "es-AR",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
