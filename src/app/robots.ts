import type { MetadataRoute } from "next";

const SITE_URL = "https://sufiankraitt.com";

/**
 * robots.txt — allow full crawling and point crawlers at the sitemap. Served at
 * /robots.txt. (Per-page index control lives in the metadata `robots` block.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
