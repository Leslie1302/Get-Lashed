"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioItem } from "@/lib/cloudinary";
import { blurCloudinaryUrl, sizedCloudinaryUrl } from "@/lib/cloudinary-loader";

export default function PortfolioLightbox({ items }: { items: PortfolioItem[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const open = index !== null;
  const item = open && index !== null ? items[index] : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const frame = frameRef.current;
      requestAnimationFrame(() => frame?.focus());
    } else if (!open && dialog.open) {
      // Esc closes the dialog natively, but the ✕ button and a backdrop click
      // only clear `index` — without this the modal and its backdrop stay up
      // over an empty dialog.
      dialog.close();
    }
  }, [open]);

  const step = useCallback(
    (delta: number) => {
      setIndex((prev) => (prev === null ? prev : (prev + delta + items.length) % items.length));
    },
    [items.length]
  );

  const close = useCallback(() => setIndex(null), []);

  return (
    <>
      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {items.map((img, i) => (
          <button
            key={img.publicId}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`View ${img.caption || img.category} work, image ${i + 1} of ${items.length}`}
            className="group relative mb-4 block w-full break-inside-avoid cursor-zoom-in overflow-hidden rounded-xl bg-linen focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <Image
              src={img.url}
              alt={img.caption || `${img.category} work`}
              width={img.width}
              height={img.height}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={i < 2}
              placeholder="blur"
              blurDataURL={blurCloudinaryUrl(img.url)}
              className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          else if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto max-w-[94vw] rounded-2xl border border-sand bg-paper p-5 text-espresso shadow-2xl backdrop:bg-espresso/70 backdrop:backdrop-blur-sm open:flex open:flex-col"
        aria-label="Portfolio lightbox"
      >
        {item && (
          <div
            ref={frameRef}
            tabIndex={-1}
            className="flex flex-col gap-4 outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="min-w-0 flex-1 truncate font-display text-lg font-medium">
                {item.caption || `${item.category} work`}
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close lightbox"
                className="shrink-0 rounded-md border border-sand px-3 py-1.5 text-sm font-semibold hover:bg-linen"
              >
                Esc ✕
              </button>
            </div>

            {/* ponytail: plain <img> for the big view — one sized URL, no srcset needed here */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sizedCloudinaryUrl(item.url, Math.min(item.width, 1600))}
              alt={item.caption || `${item.category} work`}
              width={item.width}
              height={item.height}
              className="max-h-[76vh] w-auto max-w-full rounded-lg object-contain mx-auto"
            />

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous image"
                className="rounded-md border border-sand px-4 py-2 text-sm font-semibold hover:bg-linen"
              >
                ← Prev
              </button>
              <p className="text-xs font-semibold tracking-wide text-cocoa" aria-live="polite">
                {(open && index !== null ? index + 1 : 0)} / {items.length}
              </p>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next image"
                className="rounded-md border border-sand px-4 py-2 text-sm font-semibold hover:bg-linen"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}