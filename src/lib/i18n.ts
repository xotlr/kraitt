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
    p1a: "Mein Weg in den Ton begann mit einer Frage: warum manche Aufnahmen ",
    p1Em: "da",
    p1b: " sind und andere nicht. An dieser Antwort arbeite ich heute jeden Tag, zwischen Tonangel und Mischpult, zwischen Set und Studio.",
    p2a: "Nach meinem Abschluss am ",
    p2Em: "SAE Institute",
    p2b: " habe ich gelernt, technische Präzision und gestalterisches Gehör zusammenzubringen. Film und TV verlangen Tempo und Disziplin, Musik verlangt Geduld. Beides liegt mir.",
    p3: "Ich arbeite für ORF-Produktionen, Spiel- und Kurzfilme, Dokumentationen und für Bands, die wissen, dass ein Song sich entscheidet, bevor er gemischt wird.",
    facts: [
      { k: "Basis", v: "Wien, AT" },
      { k: "Ausbildung", v: "SAE Institute" },
      { k: "Sprachen", v: "DE · EN · AR" },
      { k: "Arbeitet seit", v: "2018" },
    ],
  },

  leistungen: {
    label: "Leistungen",
    titleA: "Was ich ",
    titleEm: "tue",
    titleB: ", wenn ich arbeite.",
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
    titleA: "Eine Auswahl ",
    titleEm: "dessen, was bleibt.",
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
      "p-01": {
        role: "Audiopostproduktion",
        medium: "Magazinformat",
        description:
          "Wöchentliche Audio-Post für einen ORF-Magazinbeitrag. Sprachbearbeitung, Atmo und Musikabmischung, EBU R128 konform. Schnelle Turnarounds, broadcast-ready innerhalb von Stunden.",
        credits: [
          { label: "Sender", value: "ORF 2" },
          { label: "Format", value: "Magazin" },
          { label: "Beiträge", value: "12+" },
        ],
      },
      "p-02": {
        role: "Setton",
        medium: "Spielfilm, 92 Min.",
        description:
          "Drei Wochen Setton in Wien und Niederösterreich. Tonangel, Funkstrecken, Atmo. Enge Zusammenarbeit mit Regie und Schnitt für eine geräuschlich introspektive Bildsprache.",
        credits: [
          { label: "Regie", value: "M. Holzer" },
          { label: "Kamera", value: "L. Petković" },
          { label: "Drehtage", value: "21" },
        ],
      },
      "p-03": {
        role: "Mixing & Mastering",
        medium: "Album, 11 Tracks",
        description:
          "Hybrid-Mix mit analoger Summenbearbeitung. Vinyl- und Streaming-Master in getrennten Versionen. Fokus auf Dynamik statt Lautheit.",
        credits: [
          { label: "Genre", value: "Indie / Post-Rock" },
          { label: "Format", value: "Vinyl + Stream" },
          { label: "Tracks", value: "11" },
        ],
      },
      "p-04": {
        role: "Setton & Tonassistenz",
        medium: "Dokumentation, 45 Min.",
        description:
          "Nachtdrehs in Bergregion. Funkstrecken in feuchtem Umfeld, Atmo-Aufnahmen unter schwierigen Bedingungen. Tonassistenz für ein zweiköpfiges Team.",
        credits: [
          { label: "Sender", value: "ORF III / 3sat" },
          { label: "Drehorte", value: "5" },
          { label: "Drehtage", value: "14" },
        ],
      },
      "p-05": {
        role: "Komposition & Sounddesign",
        medium: "Kurzfilm, 18 Min.",
        description:
          "Originalmusik und komplettes Sounddesign für einen experimentellen Kurzfilm. Modular-Synthesizer-Texturen, kombiniert mit Field Recordings.",
        credits: [
          { label: "Festivals", value: "3" },
          { label: "Laufzeit", value: "18 Min." },
          { label: "Tracks", value: "Original Score" },
        ],
      },
      "p-06": {
        role: "Recording Engineer",
        medium: "Live Recording Series",
        description:
          "Mehrteilige Live-Aufnahme-Reihe in einem Wiener Kirchenraum. Ambisonic-Aufnahmen, kein Overdub. Rein dokumentarisch.",
        credits: [
          { label: "Sessions", value: "8" },
          { label: "Künstler", value: "12" },
          { label: "Setup", value: "Ambisonic" },
        ],
      },
      "p-07": {
        role: "Tonassistenz / Kamera-Ton",
        medium: "Reportage",
        description:
          "Reportage-Einsätze als Kamera-Ton-Hybrid bei kleineren Crews. ENG-Workflow, schnelle Setups, broadcast-konforme Pegel direkt aus dem Feld.",
        credits: [
          { label: "Sender", value: "ORF" },
          { label: "Format", value: "ENG" },
          { label: "Einsätze", value: "20+" },
        ],
      },
      "p-08": {
        role: "Setton & Postproduktion",
        medium: "Kurzfilm, 22 Min.",
        description:
          "Kompletter Audio-Workflow vom Setton bis zur fertigen Mischung. Stereo- und 5.1-Versionen. Festivalrundgang Europa.",
        credits: [
          { label: "Festivals", value: "Diagonale, Saarbrücken" },
          { label: "Drehtage", value: "9" },
          { label: "Format", value: "5.1 + Stereo" },
        ],
      },
      "p-09": {
        role: "Podcast Recording & Mix",
        medium: "Podcast, 24 Episoden",
        description:
          "Mehrjährige Begleitung eines Wiener Kulturpodcasts. Aufnahme in unterschiedlichsten Räumen, ein einheitlicher Mix-Standard.",
        credits: [
          { label: "Episoden", value: "24" },
          { label: "Gäste", value: "60+" },
          { label: "Laufzeit", value: "ø 38 Min." },
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
    p1a: "I came to sound through one question: why some recordings are ",
    p1Em: "there",
    p1b: " and others are not. I work on that answer every day now, between the boom and the desk, between set and studio.",
    p2a: "After finishing at ",
    p2Em: "SAE Institute",
    p2b: ", I learned to hold technical precision and a shaping ear in the same hand. Film and TV ask for speed and discipline, music asks for patience. Both suit me.",
    p3: "I work on ORF productions, features and shorts, documentaries, and with bands who know a song is decided before it ever gets mixed.",
    facts: [
      { k: "Based", v: "Vienna, AT" },
      { k: "Training", v: "SAE Institute" },
      { k: "Languages", v: "DE · EN · AR" },
      { k: "Working since", v: "2018" },
    ],
  },

  leistungen: {
    label: "Services",
    titleA: "What I ",
    titleEm: "do",
    titleB: " when I work.",
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
    titleA: "A selection of ",
    titleEm: "what lasts.",
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
      "p-01": {
        role: "Audio Post",
        medium: "Magazine format",
        description:
          "Weekly audio post for an ORF magazine segment. Dialogue editing, ambience, music balancing, EBU R128 compliant. Fast turnarounds, broadcast-ready within hours.",
        credits: [
          { label: "Channel", value: "ORF 2" },
          { label: "Format", value: "Magazine" },
          { label: "Segments", value: "12+" },
        ],
      },
      "p-02": {
        role: "Production Sound",
        medium: "Feature, 92 min",
        description:
          "Three weeks of production sound in Vienna and Lower Austria. Boom, wireless, ambience. Close work with the director and editor toward a sonically introspective feel.",
        credits: [
          { label: "Director", value: "M. Holzer" },
          { label: "Camera", value: "L. Petković" },
          { label: "Shoot days", value: "21" },
        ],
      },
      "p-03": {
        role: "Mixing & Mastering",
        medium: "Album, 11 tracks",
        description:
          "Hybrid mix with analogue bus processing. Separate vinyl and streaming masters. Focus on dynamics over loudness.",
        credits: [
          { label: "Genre", value: "Indie / Post-Rock" },
          { label: "Format", value: "Vinyl + Stream" },
          { label: "Tracks", value: "11" },
        ],
      },
      "p-04": {
        role: "Production Sound & Assist",
        medium: "Documentary, 45 min",
        description:
          "Night shoots in the mountains. Wireless in a damp environment, ambience under difficult conditions. Sound assist for a two-person team.",
        credits: [
          { label: "Channel", value: "ORF III / 3sat" },
          { label: "Locations", value: "5" },
          { label: "Shoot days", value: "14" },
        ],
      },
      "p-05": {
        role: "Composition & Sound Design",
        medium: "Short film, 18 min",
        description:
          "Original music and full sound design for an experimental short. Modular synth textures layered with field recordings.",
        credits: [
          { label: "Festivals", value: "3" },
          { label: "Runtime", value: "18 min" },
          { label: "Tracks", value: "Original score" },
        ],
      },
      "p-06": {
        role: "Recording Engineer",
        medium: "Live recording series",
        description:
          "A multi-part live recording series in a Viennese church. Ambisonic capture, no overdubs. Purely documentary.",
        credits: [
          { label: "Sessions", value: "8" },
          { label: "Artists", value: "12" },
          { label: "Setup", value: "Ambisonic" },
        ],
      },
      "p-07": {
        role: "Sound Assist / Camera Sound",
        medium: "Reportage",
        description:
          "Reportage work as a camera-sound hybrid on small crews. ENG workflow, fast setups, broadcast-compliant levels straight from the field.",
        credits: [
          { label: "Channel", value: "ORF" },
          { label: "Format", value: "ENG" },
          { label: "Assignments", value: "20+" },
        ],
      },
      "p-08": {
        role: "Production Sound & Post",
        medium: "Short film, 22 min",
        description:
          "Full audio workflow from production sound to final mix. Stereo and 5.1 versions. Festival run across Europe.",
        credits: [
          { label: "Festivals", value: "Diagonale, Saarbrücken" },
          { label: "Shoot days", value: "9" },
          { label: "Format", value: "5.1 + Stereo" },
        ],
      },
      "p-09": {
        role: "Podcast Recording & Mix",
        medium: "Podcast, 24 episodes",
        description:
          "Several years alongside a Viennese culture podcast. Recorded across all kinds of rooms, held to one mix standard.",
        credits: [
          { label: "Episodes", value: "24" },
          { label: "Guests", value: "60+" },
          { label: "Runtime", value: "ø 38 min" },
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
