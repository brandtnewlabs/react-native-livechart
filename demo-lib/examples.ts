import type { Href } from "expo-router";

/**
 * Registry for the "Examples" tab — full-screen recreations of real finance /
 * crypto apps that show LiveChart living inside a production-style UI (as
 * opposed to the feature-isolating screens under `app/demo/`).
 *
 * Adding an example is a one-liner: drop a screen under `app/showcase/<id>.tsx`,
 * then add an entry here. `status: "soon"` renders a greyed, non-tappable card
 * (no `href` needed) so the roadmap is visible while screenshots are gathered.
 */
export type ExampleStatus = "ready" | "soon";

export type ExampleEntry = {
  /** Stable id; matches the route file `app/showcase/<id>.tsx`. */
  id: string;
  /** App name shown as the card title. */
  title: string;
  /** One-line description of what this recreation showcases. */
  tagline: string;
  /** Brand accent used for the card's leading badge. */
  accent: string;
  /** Route to push full-screen. Present for `ready`, omitted for `soon`. */
  href?: Href;
  status: ExampleStatus;
};

export const EXAMPLES: ExampleEntry[] = [
  {
    id: "fomo",
    title: "Fomo",
    tagline: "Token detail — live price + scrubbable hero chart",
    accent: "#23D55C",
    href: "/showcase/fomo",
    status: "ready",
  },
  // Placeholders — rename / re-point to the apps you're capturing screenshots
  // for. Give each a `href: "/showcase/<id>"` + a screen file to flip to "ready".
  {
    id: "robinhood",
    title: "Robinhood",
    tagline: "Tokenized-stock detail — edgy line + scrub dim-split",
    accent: "#4FE05A",
    href: "/showcase/robinhood",
    status: "ready",
  },
  {
    id: "backpack",
    title: "Backpack",
    tagline: "Token detail (light) — live-scrolling edgy line + scrub split",
    accent: "#1FC85C",
    href: "/showcase/backpack",
    status: "ready",
  },
  {
    id: "coinbase",
    title: "Coinbase",
    tagline: "Asset detail page with candle + line modes",
    accent: "#0052FF",
    status: "soon",
  },
];
