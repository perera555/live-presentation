import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Live Presentation Studio",
    short_name: "LivePresent",
    description: "Slides, speech and a talking presenter video from your own photo.",
    start_url: "/",
    display: "standalone",
    background_color: "#070b16",
    theme_color: "#0f172a",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
