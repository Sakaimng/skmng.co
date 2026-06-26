import { profile } from "@/lib/site";

/**
 * Crawlable, accessible content that is visually hidden (`sr-only`) so it never
 * touches the minimal visual design. These are server components: they render
 * into the SSR HTML on every request, so crawlers and AI answer engines — which
 * do not run the client preloader/animation system — always receive real
 * headings, descriptive prose, and followable internal links. The copy is
 * truthful (taken from the site's own bio), so this is legitimate accessibility
 * markup, not cloaking.
 */

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/archive", label: "Archive — full photography catalogue" },
  { href: "/info-contact", label: "Info & contact" },
] as const;

/** Real `<a href>` links so internal pages are discoverable by crawlers. */
export function SrSiteNav() {
  return (
    <nav aria-label="SKMNG site navigation" className="sr-only">
      <ul>
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
      <p>
        Contact SKMNG by email at{" "}
        <a href={`mailto:${profile.email}`}>{profile.email}</a> or on Instagram{" "}
        <a href={profile.instagram} rel="me">
          @{profile.instagramHandle}
        </a>
        .
      </p>
    </nav>
  );
}

/** Visually-hidden `<h1>` + descriptive prose for a single route. */
export function SrPageIntro({
  heading,
  paragraphs,
}: {
  heading: string;
  paragraphs: readonly string[];
}) {
  return (
    <header className="sr-only">
      <h1>{heading}</h1>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </header>
  );
}
