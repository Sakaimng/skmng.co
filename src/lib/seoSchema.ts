import type { AssetImage } from "@/lib/assets";
import { lightboxDisplayName } from "@/lib/lightboxLabel";
import {
  absoluteUrl,
  defaultOgImagePath,
  profile,
  sameAs,
  siteUrl,
} from "@/lib/site";

/**
 * schema.org JSON-LD builders. The Person + WebSite nodes are defined once in
 * the site-wide graph (rendered from the root layout); every per-page graph
 * references them by `@id` instead of redefining them. Consumers (Google,
 * AI answer engines) merge all JSON-LD on a page into a single graph.
 */

export const websiteId = `${siteUrl}/#website`;
export const personId = `${siteUrl}/#person`;

const CONTEXT = "https://schema.org" as const;

/** Honest, unique-per-frame name for an untitled photograph. */
function photographName(fileName: string): string {
  return `Photograph by SKMNG — ${lightboxDisplayName(fileName)}`;
}

function personNode() {
  return {
    "@type": "Person",
    "@id": personId,
    name: profile.name,
    url: siteUrl,
    image: absoluteUrl(defaultOgImagePath),
    description: profile.bio,
    jobTitle: [...profile.jobTitles],
    knowsAbout: [...profile.knowsAbout],
    birthPlace: { "@type": "Place", name: profile.birthPlace },
    homeLocation: {
      "@type": "Place",
      name: profile.location.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: profile.location.city,
        addressCountry: profile.location.country,
      },
    },
    workLocation: { "@type": "Place", name: profile.location.city },
    email: `mailto:${profile.email}`,
    sameAs: [...sameAs],
  };
}

function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    url: siteUrl,
    name: profile.name,
    description: profile.tagline,
    inLanguage: "en",
    publisher: { "@id": personId },
    creator: { "@id": personId },
    about: { "@id": personId },
  };
}

/** WebSite + Person — rendered site-wide from the root layout. */
export function siteGraph() {
  return { "@context": CONTEXT, "@graph": [websiteNode(), personNode()] };
}

function breadcrumbNode(trail: ReadonlyArray<{ name: string; path: string }>) {
  const last = trail[trail.length - 1]!;
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(last.path)}#breadcrumb`,
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

function imageObjectNodes(images: AssetImage[], galleryId: string) {
  return images.map((image) => ({
    "@type": "ImageObject",
    "@id": `${absoluteUrl(image.url)}#image`,
    contentUrl: absoluteUrl(image.url),
    url: absoluteUrl(image.url),
    name: photographName(image.name),
    creator: { "@id": personId },
    copyrightHolder: { "@id": personId },
    isPartOf: { "@id": galleryId },
  }));
}

/** Home: CollectionPage → ImageGallery of selected frames. */
export function homeGraph(images: AssetImage[]) {
  const webpageId = `${siteUrl}/#webpage`;
  const galleryId = `${siteUrl}/#gallery-home`;
  return {
    "@context": CONTEXT,
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": webpageId,
        url: siteUrl,
        name: "SKMNG — Tokyo-based visual storyteller and photographer",
        description: profile.tagline,
        inLanguage: "en",
        isPartOf: { "@id": websiteId },
        about: { "@id": personId },
        primaryImageOfPage: absoluteUrl(defaultOgImagePath),
        mainEntity: { "@id": galleryId },
      },
      {
        "@type": "ImageGallery",
        "@id": galleryId,
        name: "SKMNG — selected photographs",
        isPartOf: { "@id": webpageId },
        about: { "@id": personId },
        author: { "@id": personId },
        associatedMedia: imageObjectNodes(images, galleryId),
      },
      breadcrumbNode([{ name: "Home", path: "/" }]),
    ],
  };
}

/** Archive: CollectionPage → ImageGallery of the full catalogue. */
export function archiveGraph(images: AssetImage[]) {
  const webpageId = `${absoluteUrl("/archive")}#webpage`;
  const galleryId = `${absoluteUrl("/archive")}#gallery`;
  return {
    "@context": CONTEXT,
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": webpageId,
        url: absoluteUrl("/archive"),
        name: "Photography archive — SKMNG",
        description:
          "The complete archive of cinematic, composition-led photographs by SKMNG, a Tokyo-based visual storyteller.",
        inLanguage: "en",
        isPartOf: { "@id": websiteId },
        about: { "@id": personId },
        mainEntity: { "@id": galleryId },
      },
      {
        "@type": "ImageGallery",
        "@id": galleryId,
        name: "SKMNG — photography archive",
        isPartOf: { "@id": webpageId },
        about: { "@id": personId },
        author: { "@id": personId },
        numberOfItems: images.length,
        associatedMedia: imageObjectNodes(images, galleryId),
      },
      breadcrumbNode([
        { name: "Home", path: "/" },
        { name: "Archive", path: "/archive" },
      ]),
    ],
  };
}

/** Info/contact: ProfilePage about the Person. */
export function infoGraph() {
  const webpageId = `${absoluteUrl("/info-contact")}#webpage`;
  return {
    "@context": CONTEXT,
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": webpageId,
        url: absoluteUrl("/info-contact"),
        name: "About SKMNG — Tokyo-based visual storyteller",
        description: profile.bio,
        inLanguage: "en",
        isPartOf: { "@id": websiteId },
        about: { "@id": personId },
        mainEntity: { "@id": personId },
      },
      breadcrumbNode([
        { name: "Home", path: "/" },
        { name: "Info", path: "/info-contact" },
      ]),
    ],
  };
}
