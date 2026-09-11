import Link from "next/link";

// The try-on link only appears when the AR flag is on — otherwise the route
// 404s and the nav would advertise a dead end.
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  ...(process.env.NEXT_PUBLIC_ENABLE_AR === "true"
    ? [{ href: "/try-on", label: "Try on" }]
    : []),
  { href: "/about", label: "About" },
  // Last in the row, but in it: "no payment = no confirmed appointment" is a
  // term clients are held to, and a term nobody can find is hard to enforce.
  { href: "/policy", label: "Policy" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-sand bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-espresso"
        >
          {/* Wordmark until there's a logo — one <Image /> swap when there is. */}
          Get<span className="text-terracotta"> · </span>Lashed
        </Link>

        {/* Mobile: <details> burger, no JS */}
        <details className="group relative md:hidden">
          <summary
            aria-label="Open menu"
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-sand hover:bg-linen [&::-webkit-details-marker]:hidden"
          >
            <svg
              className="h-6 w-6 text-espresso"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            </svg>
          </summary>
          <nav aria-label="Mobile" className="mt-3 w-56 rounded-lg border border-sand bg-paper p-2 shadow-lg">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="block rounded-md px-4 py-3 hover:bg-linen"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/book"
              className="mt-1 block rounded-md bg-terracotta px-4 py-3 text-center font-semibold text-paper hover:bg-clay"
            >
              Book online
            </Link>
          </nav>
        </details>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-cocoa hover:text-espresso"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/book"
            className="rounded-md bg-terracotta px-5 py-2.5 text-sm font-semibold text-paper hover:bg-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Book online
          </Link>
        </nav>
      </div>
    </header>
  );
}