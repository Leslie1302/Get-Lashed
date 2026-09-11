import type { Metadata } from "next";
import Link from "next/link";
import { getPortfolio } from "@/lib/cloudinary";
import PortfolioLightbox from "@/components/PortfolioLightbox";

export const metadata: Metadata = {
  title: "Portfolio",
};

const CATEGORY_TABS = [
  { tag: null, label: "All" },
  { tag: "nails", label: "Nails" },
  { tag: "lashes", label: "Lashes" },
  { tag: "pedicure", label: "Pedicure" },
] as const;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { category } = await searchParams;
  const raw = typeof category === "string" ? category : undefined;
  const valid = raw !== undefined && CATEGORY_TABS.some((t) => t.tag === raw);
  const active = valid ? raw : undefined;
  const all = await getPortfolio();
  const items = valid ? all.filter((i) => i.category === active) : all;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <header className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracotta">
          Portfolio
        </p>
        <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
          Fresh work from the studio
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-cocoa">
          Set after set, straight off the table. Tap any photo to view it full size;
          every shot is real client work.
        </p>
      </header>

      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Filter portfolio">
        {CATEGORY_TABS.map((tab) => {
          const isActive = active === undefined ? tab.tag === null : tab.tag === active;
          return (
            <Link
              key={tab.label}
              aria-current={isActive ? "page" : undefined}
              href={tab.tag ? `/portfolio?category=${tab.tag}` : "/portfolio"}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${
                isActive
                  ? "bg-espresso text-paper"
                  : "border border-sand text-cocoa hover:border-terracotta hover:text-terracotta"
              } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <section className="mt-10" aria-label={`${active ?? "all"} work`}>
        {items.length > 0 ? (
          <PortfolioLightbox items={items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-sand bg-linen/50 p-14 text-center">
            <p className="font-display text-xl font-medium text-cocoa">
              {credentialsMissing
                ? "Portfolio photos are being prepared."
                : "Nothing here yet in this category."}
            </p>
            <p className="mt-2 text-sm text-mocha">
              {credentialsMissing
                ? "Add CLOUDINARY_CLOUD_NAME, API key and secret to unlock the gallery."
                : "More photos are uploaded every week — check back soon."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const credentialsMissing = !(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);