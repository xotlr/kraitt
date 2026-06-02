export type Category = "tv" | "musik" | "film";

/**
 * Language-invariant project facts. Everything that reads differently in
 * DE vs EN (role, medium, description, credits) lives in src/lib/i18n.ts,
 * keyed by the same `id`. This file holds only what doesn't translate:
 * the title, client, year, category, and outbound link.
 */
export type Project = {
  id: string;
  title: string;
  client: string;
  category: Category;
  year: number;
  link?: { label: string; href: string };
};

export const projects: Project[] = [
  {
    id: "p-oskar",
    title: "OSKAR",
    client: "Verso Studios",
    category: "film",
    year: 2026,
    link: { label: "verso.ac", href: "https://verso.ac" },
  },
  {
    id: "p-last-knight",
    title: "THE LAST KNIGHT",
    client: "Verso Studios",
    category: "film",
    year: 2027,
    link: { label: "verso.ac", href: "https://verso.ac" },
  },
  {
    id: "p-stadt-ohne-heimat",
    title: "Stadt ohne Heimat",
    client: "TV-Dokumentation",
    category: "tv",
    year: 2025,
    link: {
      label: "IMDb",
      href: "https://www.imdb.com/name/nm17906294/",
    },
  },
  {
    id: "p-zar-und-hitler",
    title: "Zwischen Zar und Hitler",
    client: "TV-Dokumentation",
    category: "tv",
    year: 2025,
    link: {
      label: "IMDb",
      href: "https://www.imdb.com/name/nm17906294/",
    },
  },
  {
    id: "p-last-feminist",
    title: "The Last Feminist",
    client: "brut Wien",
    category: "musik",
    year: 2024,
    link: {
      label: "brut-wien.at",
      href: "https://brut-wien.at/en/Programme/Calendar/Programm-2024/10/Myassa-Kraitt",
    },
  },
  // Further verified entries (Musik & Studio, Film) get added here as Sufian
  // supplies real titles, roles, and years. No placeholders.
];
