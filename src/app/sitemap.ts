import type { MetadataRoute } from "next";

const SITE_URL = "https://sufiankraitt.com";

/**
 * sitemap.xml — a single-page site, so one entry. Served at /sitemap.xml and
 * referenced from robots.txt. lastModified is omitted (no build-time date here;
 * the page is evergreen) so Google re-crawls on its own cadence.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
