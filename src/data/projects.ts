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
    id: "p-01",
    title: "Heute Konkret",
    client: "ORF",
    category: "tv",
    year: 2025,
  },
  {
    id: "p-02",
    title: "Ein Fenster nach Innen",
    client: "Independent",
    category: "film",
    year: 2024,
  },
  {
    id: "p-03",
    title: "MARLOW · Halflight LP",
    client: "Marlow",
    category: "musik",
    year: 2025,
  },
  {
    id: "p-04",
    title: "Salzkammergut bei Nacht",
    client: "ORF / 3sat",
    category: "tv",
    year: 2024,
  },
  {
    id: "p-05",
    title: "Ground Truth",
    client: "ArtScience Lab",
    category: "film",
    year: 2024,
  },
  {
    id: "p-06",
    title: "Cathedral Sessions",
    client: "Various Artists",
    category: "musik",
    year: 2023,
  },
  {
    id: "p-07",
    title: "Zeit im Bild: Reportage",
    client: "ORF",
    category: "tv",
    year: 2023,
  },
  {
    id: "p-08",
    title: "Halbschatten",
    client: "Halbschatten Film",
    category: "film",
    year: 2023,
  },
  {
    id: "p-09",
    title: "Voices of Vienna",
    client: "Independent Podcast",
    category: "musik",
    year: 2025,
  },
];
