import {
  EnvelopeSimple,
  FilmSlate,
  House,
  SlidersHorizontal,
  UserSound,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Shared console control data — single source of truth for both the
 * desktop side rails and the mobile bottom panel.
 *
 * Each section carries a Phosphor icon. The buttons render it at
 * `weight="regular"` (outline) when idle and `weight="fill"` when active,
 * which is the outline→fill state the console asks for.
 */

export interface Section {
  id: string;
  /** Short channel-strip label (mono) — kept for a11y / mobile, hidden
   *  on the desktop rail where icons carry the meaning. */
  label: string;
  icon: Icon;
}

export const SECTIONS: Section[] = [
  { id: "hero", label: "Index", icon: House },
  { id: "ueber", label: "Über", icon: UserSound },
  { id: "leistungen", label: "Leistungen", icon: SlidersHorizontal },
  { id: "referenzen", label: "Referenzen", icon: FilmSlate },
  { id: "kontakt", label: "Kontakt", icon: EnvelopeSimple },
];
