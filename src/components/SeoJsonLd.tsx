import { JsonLd } from "@/components/JsonLd";
import { siteGraph } from "@/lib/seoSchema";

/**
 * Site-wide JSON-LD graph (WebSite + Person) with stable `@id`s. Per-page
 * graphs reference these nodes by `@id` rather than redefining them.
 */
export function SeoJsonLd() {
  return <JsonLd id="seo-jsonld" data={siteGraph()} />;
}
