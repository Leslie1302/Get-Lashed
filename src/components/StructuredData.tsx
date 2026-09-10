import {
  BUSINESS,

  SERVICES,
  WEEKDAY_ORDER,
} from "@/lib/constants";
import { siteUrl } from "@/lib/site";
import { publicHours } from "@/lib/public-hours";

const SCHEMA_DAY: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

/**
 * LocalBusiness JSON-LD. This is what puts opening hours and a price list in
 * Google's local results — the single highest-value SEO item for a salon that
 * people find by searching "nails near me" in Accra.
 */
export default async function StructuredData() {
  const hours = await publicHours();
  const url = siteUrl();

  const data = {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    name: BUSINESS.name,
    description: BUSINESS.tagline,
    url,
    telephone: BUSINESS.phone,
    image: `${url}/opengraph-image`,
    priceRange: "₵₵",
    currenciesAccepted: "GHS",
    address: {
      "@type": "PostalAddress",
      streetAddress: BUSINESS.address,
      addressLocality: "Kweiman",
      addressRegion: "Greater Accra",
      addressCountry: "GH",
    },
    sameAs: Object.values(BUSINESS.socialLinks),
    openingHoursSpecification: WEEKDAY_ORDER.flatMap((day) => {
      const h = hours[day];
      return h
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: SCHEMA_DAY[day],
              opens: h.opens,
              closes: h.closes,
            },
          ]
        : [];
    }),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: SERVICES.map((service) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: service.name, description: service.description },
        price: service.priceGHS,
        priceCurrency: "GHS",
      })),
    },
  };

  return (
    <script
      type="application/ld+json"
      // Values come from constants.ts, not user input. JSON.stringify still
      // escapes the one character that could close the tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
