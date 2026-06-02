import type { Lang } from "@/lib/language-context";

/**
 * All user-facing copy, in both languages.
 *
 * This is the seam the language-context note pointed at: the toggle flips
 * `lang`, sections read their strings from here. Typed `.ts` data, no CMS,
 * matching how src/data already works.
 *
 * Style: no em-dashes anywhere in rendered copy. Commas, periods, or a
 * recast sentence instead. Keep it plain and spoken, not brochure-stiff.
 */

export interface Dict {
  /** Section nav + console labels, keyed by section id. */
  nav: {
    hero: string;
    ueber: string;
    leistungen: string;
    referenzen: string;
    kontakt: string;
  };

  console: {
    music: string;
    musicUnavailable: string;
    mic: string;
    mute: string;
    unmute: string;
    language: (active: string) => string;
    /** Mobile transport: the track name shown in the scrubber pill, the
     *  scrubber's a11y label, and the volume swipe a11y label. */
    track: string;
    transport: string;
    volume: string;
  };

  meter: {
    fader: string;
    clip: string;
    levelOk: string;
  };

  hero: {
    eyebrow: string;
    leadIn: string;
    film: string;
    television: string;
    music: string;
    leadOut: string;
    tags: string[];
    scroll: string;
  };

  ueber: {
    label: string;
    titleA: string;
    titleEm: string;
    titleB: string;
    p1a: string;
    p1Em: string;
    p1b: string;
    p2a: string;
    p2Em: string;
    p2b: string;
    p3: string;
    facts: { k: string; v: string }[];
  };

  leistungen: {
    label: string;
    titleA: string;
    titleEm: string;
    titleB: string;
    columns: {
      heading: string;
      index: string;
      items: { name: string; desc: string }[];
    }[];
  };

  referenzen: {
    label: string;
    titleA: string;
    titleEm: string;
    categories: { id: string; label: string }[];
    /** Per-project copy keyed by project id; titles/years live in data. */
    projects: Record<
      string,
      {
        role: string;
        medium: string;
        description: string;
        credits: { label: string; value: string }[];
      }
    >;
    linkLabel?: string;
  };

  kontakt: {
    label: string;
    titleA: string;
    titleEm: string;
    titleB: string;
    write: string;
    role: string;
    rights: string;
  };
}

const de: Dict = {
  nav: {
    hero: "Index",
    ueber: "Über",
    leistungen: "Leistungen",
    referenzen: "Referenzen",
    kontakt: "Kontakt",
  },

  console: {
    music: "Musik",
    musicUnavailable: "Musik nicht verfügbar",
    mic: "Mikrofon",
    mute: "Stummschalten",
    unmute: "Ton einschalten",
    language: (active) => `Sprache: ${active}. Umschalten`,
    track: "Chopin · Nocturne Op. 55/1",
    transport: "Wiedergabe. Ziehen zum Spulen",
    volume: "Lautstärke. Horizontal wischen",
  },

  meter: {
    fader: "Lautstärke (Fader)",
    clip: "Clip. Zum Zurücksetzen klicken",
    levelOk: "Pegel ok",
  },

  hero: {
    eyebrow: "Wien · Audio Engineer · Verfügbar 2026",
    leadIn: "Audio für ",
    film: "Film",
    television: "Fernsehen",
    music: "Musikproduktion",
    leadOut: ". Am Set, im Studio, in der Post.",
    tags: ["Setton", "Postproduktion", "Mixing", "Mastering", "Komposition"],
    scroll: "Scroll",
  },

  ueber: {
    label: "Über",
    titleA: "Ein Ohr für den ",
    titleEm: "Raum zwischen",
    titleB: " den Tönen.",
    p1a: "Mein Weg in den Ton begann mit einer Frage: warum manche Aufnahmen da sind und andere nicht. An dieser Antwort arbeite ich heute jeden Tag, zwischen Tonangel und Mischpult, zwischen Set und Studio.",
    p1Em: "",
    p1b: "",
    p2a: "Nach meinem Abschluss am ",
    p2Em: "SAE Institute",
    p2b: " habe ich gelernt, technische Präzision und gestalterisches Gehör zusammenzubringen. Film und TV verlangen Tempo und Disziplin, Musik verlangt Geduld. Beides liegt mir.",
    p3: "Meine Arbeit reicht von Filmton und TV über Studio bis zur Musikproduktion — Setton und Postproduktion, Aufnahme und Mischung. Ein Song entscheidet sich, bevor er gemischt wird; daran arbeite ich.",
    facts: [
      { k: "Basis", v: "Wien, AT" },
      { k: "Ausbildung", v: "SAE Institute" },
      { k: "Sprachen", v: "DE · EN" },
    ],
  },

  leistungen: {
    label: "Leistungen",
    titleA: "Was ich tue, wenn ich arbeite.",
    titleEm: "",
    titleB: "",
    columns: [
      {
        heading: "Film & TV",
        index: "A",
        items: [
          { name: "Setton", desc: "Aufnahme am Drehort." },
          { name: "Tonassistenz", desc: "Angel, Funk, Support." },
          { name: "Audiopostproduktion", desc: "Schnitt, Design, Mix." },
          { name: "Sprachbearbeitung", desc: "ADR, Dialog-Cleanup." },
          { name: "Broadcast Audio", desc: "TV-konforme Mischung." },
        ],
      },
      {
        heading: "Studio & Musik",
        index: "B",
        items: [
          { name: "Bandrecordings", desc: "Live im Raum, ehrlich." },
          { name: "Vocal Recording", desc: "Stimme im Mittelpunkt." },
          { name: "Musikproduktion", desc: "Vom Demo zum Master." },
          { name: "Mixing", desc: "Hybrid, in-the-box." },
          { name: "Mastering", desc: "Der letzte Schliff." },
          { name: "Komposition", desc: "Score und Sounddesign." },
        ],
      },
      {
        heading: "Content & Medien",
        index: "C",
        items: [
          { name: "Podcast Recording", desc: "Mehrere Stimmen, ein Raum." },
          { name: "Audiorestauration", desc: "Archive retten." },
          { name: "Audio Cleanup", desc: "Rauschen, Hall, Artefakte." },
          { name: "Sprachaufnahmen", desc: "Voiceover, Hörbuch, IVR." },
          { name: "Social Media Audio", desc: "Für mobil optimiert." },
          { name: "Voiceover", desc: "Werbung, Erklärfilme." },
        ],
      },
    ],
  },

  referenzen: {
    label: "Referenzen",
    titleA: "Eine Auswahl dessen, was bleibt.",
    titleEm: "",
    categories: [
      { id: "all", label: "Alle" },
      { id: "tv", label: "TV & Broadcast" },
      { id: "film", label: "Film" },
      { id: "musik", label: "Musik & Studio" },
    ],
    projects: {
      "p-oskar": {
        role: "Tonmeister",
        medium: "Kurzfilm, Release Herbst 2026",
        description:
          "Ein Mann hört durch seine Wand häusliche Gewalt. Heute Nacht muss er sich zwingen zu handeln.",
        credits: [
          { label: "Start", value: "Herbst 2026" },
          { label: "Rolle", value: "Tonmeister" },
          { label: "Format", value: "Kurzfilm" },
        ],
      },
      "p-last-knight": {
        role: "Tonmeister",
        medium: "Kurzfilm, Release Frühjahr 2027",
        description:
          "Fünfhundert Jahre später schreitet der unentschlossene Prinz Maximilian I. durch den Frieden, den er nie erlebt hat.",
        credits: [
          { label: "Start", value: "Frühjahr 2027" },
          { label: "Rolle", value: "Tonmeister" },
          { label: "Format", value: "Kurzfilm" },
        ],
      },
      "p-stadt-ohne-heimat": {
        role: "Tonaufnahme",
        medium: "Stadt ohne Heimat – Von Königsberg nach Kaliningrad in 800 Jahren",
        description:
          "Setton für eine TV-Dokumentation über die wechselvolle Geschichte Königsbergs / Kaliningrads.",
        credits: [
          { label: "Rolle", value: "Sound Recordist" },
          { label: "Format", value: "TV-Dokumentation" },
          { label: "Jahr", value: "2025" },
        ],
      },
      "p-zar-und-hitler": {
        role: "Tonaufnahme",
        medium: "Zwischen Zar und Hitler – Das Erbe der Weißen Armee",
        description:
          "Setton für eine TV-Dokumentation über das Erbe der Weißen Armee zwischen Zarenreich und 20. Jahrhundert.",
        credits: [
          { label: "Rolle", value: "Sound Recordist" },
          { label: "Format", value: "TV-Dokumentation" },
          { label: "Jahr", value: "2025" },
        ],
      },
      "p-last-feminist": {
        role: "Produktion & Rap-Coaching",
        medium: "Bühnenproduktion, brut Wien",
        description:
          "Produktion, technische Assistenz und Rap-Coaching für die Bühnenproduktion „The Last Feminist“ von Myassa Kraitt am brut Wien.",
        credits: [
          { label: "Haus", value: "brut Wien" },
          { label: "Rolle", value: "Produktion / Coaching" },
          { label: "Jahr", value: "2024" },
        ],
      },
    },
    linkLabel: undefined,
  },

  kontakt: {
    label: "Kontakt",
    titleA: "Reden wir über das ",
    titleEm: "Klangbild",
    titleB: ".",
    write: "E-Mail schreiben",
    role: "Audio Engineer · Wien, AT",
    rights: "Alle Rechte vorbehalten.",
  },
};

const en: Dict = {
  nav: {
    hero: "Index",
    ueber: "About",
    leistungen: "Services",
    referenzen: "Work",
    kontakt: "Contact",
  },

  console: {
    music: "Music",
    musicUnavailable: "Music unavailable",
    mic: "Microphone",
    mute: "Mute",
    unmute: "Unmute",
    language: (active) => `Language: ${active}. Switch`,
    track: "Chopin · Nocturne Op. 55/1",
    transport: "Playback. Drag to scrub",
    volume: "Volume. Swipe horizontally",
  },

  meter: {
    fader: "Volume (fader)",
    clip: "Clip. Click to reset",
    levelOk: "Level ok",
  },

  hero: {
    eyebrow: "Vienna · Audio Engineer · Available 2026",
    leadIn: "Audio for ",
    film: "film",
    television: "television",
    music: "music production",
    leadOut: ". On set, in the studio, in post.",
    tags: ["Production Sound", "Post", "Mixing", "Mastering", "Composition"],
    scroll: "Scroll",
  },

  ueber: {
    label: "About",
    titleA: "An ear for the ",
    titleEm: "space between",
    titleB: " the notes.",
    p1a: "I came to sound through one question: why some recordings are there and others are not. I work on that answer every day now, between the boom and the desk, between set and studio.",
    p1Em: "",
    p1b: "",
    p2a: "After finishing at ",
    p2Em: "SAE Institute",
    p2b: ", I learned to hold technical precision and a shaping ear in the same hand. Film and TV ask for speed and discipline, music asks for patience. Both suit me.",
    p3: "My work runs from film and TV sound through studio to music production — production sound and post, recording and mixing. A song is decided before it ever gets mixed; that's the part I work on.",
    facts: [
      { k: "Based", v: "Vienna, AT" },
      { k: "Training", v: "SAE Institute" },
      { k: "Languages", v: "DE · EN" },
    ],
  },

  leistungen: {
    label: "Services",
    titleA: "What I do, when I work.",
    titleEm: "",
    titleB: "",
    columns: [
      {
        heading: "Film & TV",
        index: "A",
        items: [
          { name: "Production Sound", desc: "On-location recording." },
          { name: "Sound Assist", desc: "Boom, wireless, support." },
          { name: "Audio Post", desc: "Edit, design, mix." },
          { name: "Dialogue Editing", desc: "ADR, dialogue clean-up." },
          { name: "Broadcast Audio", desc: "TV-spec mix." },
        ],
      },
      {
        heading: "Studio & Music",
        index: "B",
        items: [
          { name: "Band Recording", desc: "Live in the room, honest." },
          { name: "Vocal Recording", desc: "Voice front and centre." },
          { name: "Music Production", desc: "From demo to master." },
          { name: "Mixing", desc: "Hybrid, in-the-box." },
          { name: "Mastering", desc: "The final pass." },
          { name: "Composition", desc: "Score and sound design." },
        ],
      },
      {
        heading: "Content & Media",
        index: "C",
        items: [
          { name: "Podcast Recording", desc: "Many voices, one room." },
          { name: "Audio Restoration", desc: "Rescuing archives." },
          { name: "Audio Cleanup", desc: "Noise, reverb, artefacts." },
          { name: "Voice Recording", desc: "Voiceover, audiobook, IVR." },
          { name: "Social Media Audio", desc: "Built for mobile." },
          { name: "Voiceover", desc: "Ads, explainers." },
        ],
      },
    ],
  },

  referenzen: {
    label: "Work",
    titleA: "A selection of what lasts.",
    titleEm: "",
    categories: [
      { id: "all", label: "All" },
      { id: "tv", label: "TV & Broadcast" },
      { id: "film", label: "Film" },
      { id: "musik", label: "Music & Studio" },
    ],
    projects: {
      "p-oskar": {
        role: "Sound Supervisor",
        medium: "Short film, out autumn 2026",
        description:
          "A man hears domestic violence through his wall. Tonight he has to make himself act.",
        credits: [
          { label: "Release", value: "Autumn 2026" },
          { label: "Role", value: "Sound Supervisor" },
          { label: "Format", value: "Short film" },
        ],
      },
      "p-last-knight": {
        role: "Sound Supervisor",
        medium: "Short film, out spring 2027",
        description:
          "Five hundred years on, the irresolute Prince Maximilian I walks through a peace he never lived to see.",
        credits: [
          { label: "Release", value: "Spring 2027" },
          { label: "Role", value: "Sound Supervisor" },
          { label: "Format", value: "Short film" },
        ],
      },
      "p-stadt-ohne-heimat": {
        role: "Production Sound",
        medium: "Stadt ohne Heimat – Von Königsberg nach Kaliningrad in 800 Jahren",
        description:
          "Production sound for a TV documentary on the turbulent history of Königsberg / Kaliningrad.",
        credits: [
          { label: "Role", value: "Sound Recordist" },
          { label: "Format", value: "TV documentary" },
          { label: "Year", value: "2025" },
        ],
      },
      "p-zar-und-hitler": {
        role: "Production Sound",
        medium: "Zwischen Zar und Hitler – Das Erbe der Weißen Armee",
        description:
          "Production sound for a TV documentary on the legacy of the White Army between the Tsarist era and the 20th century.",
        credits: [
          { label: "Role", value: "Sound Recordist" },
          { label: "Format", value: "TV documentary" },
          { label: "Year", value: "2025" },
        ],
      },
      "p-last-feminist": {
        role: "Production & Rap Coaching",
        medium: "Stage production, brut Wien",
        description:
          "Production, technical assistance and rap coaching for the stage production “The Last Feminist” by Myassa Kraitt at brut Wien.",
        credits: [
          { label: "Venue", value: "brut Wien" },
          { label: "Role", value: "Production / Coaching" },
          { label: "Year", value: "2024" },
        ],
      },
    },
    linkLabel: undefined,
  },

  kontakt: {
    label: "Contact",
    titleA: "Let's talk about the ",
    titleEm: "sound",
    titleB: ".",
    write: "Send an email",
    role: "Audio Engineer · Vienna, AT",
    rights: "All rights reserved.",
  },
};

export const DICT: Record<Lang, Dict> = { de, en };

export function dict(lang: Lang): Dict {
  return DICT[lang];
}
