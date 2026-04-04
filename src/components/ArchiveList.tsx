import type { Work } from "@/data/works";
import { SiteHeader } from "@/components/SiteHeader";

export function ArchiveList({
  items,
}: {
  items: Work[];
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader currentPath="/archive" />

      <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24">
        <h1 className="text-white/42">
          Archive
        </h1>

        <ol className="mt-12">
        {items.map((work, index) => (
          <li key={work.id}>
            <div className="group flex items-baseline gap-6 border-b border-white/10 py-5 transition hover:border-white/25">
              <span className="min-w-8 text-white/35">
                {index + 1}
              </span>
              <h2 className="text-white/92 transition group-hover:text-white">
                {work.title}
              </h2>
            </div>
          </li>
        ))}
        </ol>
      </div>
    </div>
  );
}
