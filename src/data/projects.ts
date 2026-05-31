export type Category = "tv" | "musik" | "film";

export type Project = {
  id: string;
  title: string;
  client: string;
  role: string;
  category: Category;
  year: number;
  medium: string;
  description: string;
  credits: { label: string; value: string }[];
  link?: { label: string; href: string };
};

export const categories: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "tv", label: "TV & Broadcast" },
  { id: "film", label: "Film" },
  { id: "musik", label: "Musik & Studio" },
];

export const projects: Project[] = [
  {
    id: "p-oskar",
    title: "Oskar",
    client: "Verso Studios",
    role: "Tonmeister",
    category: "film",
    year: 2026,
    medium: "Kurzfilm — Release Herbst 2026",
    description:
      "Ein Mann hört durch seine Wand häusliche Gewalt. Heute Nacht muss er sich zwingen zu handeln.",
    credits: [
      { label: "Start", value: "Herbst 2026" },
      { label: "Rolle", value: "Tonmeister" },
      { label: "Format", value: "Kurzfilm" },
    ],
    link: { label: "verso.ac", href: "https://verso.ac" },
  },
  {
    id: "p-last-knight",
    title: "The Last Knight",
    client: "Verso Studios",
    role: "Tonmeister",
    category: "film",
    year: 2027,
    medium: "Kurzfilm — Release Frühjahr 2027",
    description:
      "Fünfhundert Jahre später schreitet der unentschlossene Prinz Maximilian I. durch den Frieden, den er nie erlebt hat.",
    credits: [
      { label: "Start", value: "Frühjahr 2027" },
      { label: "Rolle", value: "Tonmeister" },
      { label: "Format", value: "Kurzfilm" },
    ],
    link: { label: "verso.ac", href: "https://verso.ac" },
  },
  {
    id: "p-01",
    title: "Heute Konkret",
    client: "ORF",
    role: "Audiopostproduktion",
    category: "tv",
    year: 2025,
    medium: "Magazinformat",
    description:
      "Wöchentliche Audio-Post für einen ORF-Magazinbeitrag. Sprachbearbeitung, Atmo, Musikabmischung in EBU R128 konformer Loudness. Schnelle Turnarounds, broadcast-ready innerhalb von Stunden.",
    credits: [
      { label: "Sender", value: "ORF 2" },
      { label: "Format", value: "Magazin" },
      { label: "Beiträge", value: "12+" },
    ],
  },
  {
    id: "p-02",
    title: "Ein Fenster nach Innen",
    client: "Independent",
    role: "Setton",
    category: "film",
    year: 2024,
    medium: "Spielfilm — 92 Min.",
    description:
      "Drei Wochen Setton in Wien und Niederösterreich. Tonangel, Funkstrecken, Atmo-Aufnahmen. Enge Zusammenarbeit mit Regie und Schnitt für eine geräuschlich introspektive Bildsprache.",
    credits: [
      { label: "Regie", value: "M. Holzer" },
      { label: "Kamera", value: "L. Petković" },
      { label: "Drehtage", value: "21" },
    ],
  },
  {
    id: "p-03",
    title: "MARLOW — Halflight LP",
    client: "Marlow",
    role: "Mixing & Mastering",
    category: "musik",
    year: 2025,
    medium: "Album — 11 Tracks",
    description:
      "Hybrid-Mix mit analoger Summenbearbeitung. Vinyl- und Streaming-Master in getrennten Versionen. Fokus auf Dynamik statt Lautheit.",
    credits: [
      { label: "Genre", value: "Indie / Post-Rock" },
      { label: "Format", value: "Vinyl + Stream" },
      { label: "Tracks", value: "11" },
    ],
  },
  {
    id: "p-04",
    title: "Salzkammergut bei Nacht",
    client: "ORF / 3sat",
    role: "Setton & Tonassistenz",
    category: "tv",
    year: 2024,
    medium: "Dokumentation — 45 Min.",
    description:
      "Nachtdrehs in Bergregion: Funkstrecken in feuchtem Umfeld, Atmo-Aufnahmen unter herausfordernden Bedingungen. Tonassistenz für ein zweiköpfiges Team.",
    credits: [
      { label: "Sender", value: "ORF III / 3sat" },
      { label: "Drehorte", value: "5" },
      { label: "Drehtage", value: "14" },
    ],
  },
  {
    id: "p-05",
    title: "Ground Truth",
    client: "ArtScience Lab",
    role: "Komposition & Sounddesign",
    category: "film",
    year: 2024,
    medium: "Kurzfilm — 18 Min.",
    description:
      "Originalmusik und vollständiges Sounddesign für einen experimentellen Kurzfilm. Modular-Synthesizer-Texturen kombiniert mit field recordings.",
    credits: [
      { label: "Festivals", value: "3" },
      { label: "Laufzeit", value: "18 Min." },
      { label: "Tracks", value: "Original Score" },
    ],
  },
  {
    id: "p-06",
    title: "Cathedral Sessions",
    client: "Various Artists",
    role: "Recording Engineer",
    category: "musik",
    year: 2023,
    medium: "Live Recording Series",
    description:
      "Mehrteilige Live-Aufnahme-Reihe in einem Wiener Kirchenraum. Ambisonic-Aufnahmen, kein Overdub. Pur dokumentarisch.",
    credits: [
      { label: "Sessions", value: "8" },
      { label: "Künstler", value: "12" },
      { label: "Setup", value: "Ambisonic" },
    ],
  },
  {
    id: "p-07",
    title: "Zeit im Bild — Reportage",
    client: "ORF",
    role: "Tonassistenz / Kamera-Ton",
    category: "tv",
    year: 2023,
    medium: "Reportage",
    description:
      "Reportage-Einsätze als Kamera-Ton-Hybrid bei kleineren Crews. ENG-Workflow, schnelle Setups, broadcast-konforme Audiopegel direkt aus dem Feld.",
    credits: [
      { label: "Sender", value: "ORF" },
      { label: "Format", value: "ENG" },
      { label: "Einsätze", value: "20+" },
    ],
  },
  {
    id: "p-08",
    title: "Halbschatten",
    client: "Halbschatten Film",
    role: "Setton & Postproduktion",
    category: "film",
    year: 2023,
    medium: "Kurzfilm — 22 Min.",
    description:
      "Kompletter Audio-Workflow vom Setton bis zur fertigen Mischung. Stereo- und 5.1-Versionen. Festivalrundgang Europa.",
    credits: [
      { label: "Festivals", value: "Diagonale, Saarbrücken" },
      { label: "Drehtage", value: "9" },
      { label: "Format", value: "5.1 + Stereo" },
    ],
  },
  {
    id: "p-09",
    title: "Voices of Vienna",
    client: "Independent Podcast",
    role: "Podcast Recording & Mix",
    category: "musik",
    year: 2025,
    medium: "Podcast — 24 Episoden",
    description:
      "Mehrjährige Begleitung eines Wiener Kulturpodcasts. Aufnahme in unterschiedlichsten Räumen, einheitlicher Mix-Standard.",
    credits: [
      { label: "Episoden", value: "24" },
      { label: "Gäste", value: "60+" },
      { label: "Laufzeit", value: "∅ 38 Min." },
    ],
  },
];
