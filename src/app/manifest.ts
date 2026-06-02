import type { MetadataRoute } from "next";

/**
 * Web app manifest — names the site for the browser/home-screen and points at
 * the branded icons. App Router serves this at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sufian Kraitt — Audio Engineer",
    short_name: "Sufian Kraitt",
    description:
      "Audio Engineer für Film, TV und Musikproduktion. Wien, AT.",
    start_url: "/",
    display: "standalone",
    background_color: "#070808",
    theme_color: "#070808",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
