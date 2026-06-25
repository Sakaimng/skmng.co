import { SiteHeader } from "@/components/SiteHeader";

export default function InfoContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <SiteHeader currentPath="/info-contact" />

      <div
        data-page-content
        className="mx-auto max-w-[1600px] px-4 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24"
      >
        <div className="max-w-4xl">
          <p className="text-white/42">
            Info &amp; Contact
          </p>

          <p className="mt-12 max-w-3xl leading-[1.7] text-white/92">
            SKMNG is a visual practice built around image-making, direction, and
            mood-driven storytelling. This page is set up as a clean editorial
            space for your studio statement, selected context, and contact
            details.
          </p>

          <p className="mt-8 max-w-3xl leading-[1.9] text-white/66">
            Replace this placeholder copy with your own biography, project
            approach, location, and preferred contact channels. The layout is
            intentionally minimal so it stays close to the feel of the
            reference while fitting the SKMNG identity.
          </p>
        </div>

        <div className="mt-20 border-t border-white/10 pt-10 text-white/58">
          <p className="text-white">SKMNG</p>
          <p className="mt-4">Location / Studio</p>
          <p className="mt-4">contact@skmng.co</p>
        </div>
      </div>
    </main>
  );
}
