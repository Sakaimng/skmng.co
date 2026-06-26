/**
 * Server-rendered JSON-LD `<script>` — Next.js's recommended pattern for
 * structured data (rendered from a Server Component so it ships in the SSR HTML
 * as a clean, crawler-parseable tag and is never hydrated on the client).
 * `<` is escaped to < so the payload can't break out of the script element.
 */
export function JsonLd({ id, data }: { id?: string; data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
