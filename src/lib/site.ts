/** Canonical production origin — used for metadata, sitemap, and JSON-LD. */
export const siteUrl = "https://skmng.co" as const;

/** Representative image for Open Graph / Twitter (under `public/`). */
export const defaultOgImagePath = "/assets/L1054162.jpg" as const;

/** Intrinsic pixel size of {@link defaultOgImagePath} (portrait source frame). */
export const defaultOgImageSize = { width: 1688, height: 3000 } as const;

/** Portrait used as the Info page social image. */
export const portraitOgImagePath = "/assets/KURO.jpg" as const;
export const portraitOgImageSize = { width: 1997, height: 3000 } as const;

export function absoluteUrl(pathname: string): string {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(p, `${siteUrl}/`).toString();
}

/**
 * Single source of truth for who SKMNG is. Consumed by metadata, JSON-LD,
 * the crawlable sr-only content, and `/llms.txt`. Facts here are taken
 * verbatim from the site's own bio copy — keep it truthful.
 */
export const profile = {
  name: "SKMNG",
  /** Short, entity-dense one-liner for descriptions and AI answer engines. */
  tagline:
    "SKMNG is a Hong Kong–born, Tokyo-based visual storyteller, photographer, artist and graphic designer.",
  /** Longer factual summary used in JSON-LD and llms.txt. */
  bio: "SKMNG is a visual storyteller, photographer, artist and graphic designer. Born in Hong Kong and based in Tokyo, Japan, his work centres on composition, silhouette and emotional resonance. He began photographing with his mother's camera at the age of 14 and works exclusively with prime lenses — 28mm and 43mm — moving with the frame rather than zooming.",
  jobTitles: [
    "Photographer",
    "Visual storyteller",
    "Artist",
    "Graphic designer",
  ],
  knowsAbout: [
    "Photography",
    "Cinematic photography",
    "Composition",
    "Prime lens photography",
    "Street photography",
    "Visual storytelling",
    "Graphic design",
  ],
  birthPlace: "Hong Kong",
  location: { city: "Tokyo", country: "JP" },
  email: "info@skmng.co",
  instagram: "https://www.instagram.com/skmng.co/",
  instagramHandle: "skmng.co",
  cosmos: "https://www.cosmos.so/skmng.co",
} as const;

/** External profiles for schema.org `sameAs`. */
export const sameAs = [profile.instagram, profile.cosmos] as const;
