// Shared SEO / structured-data helpers. Every page that emits JSON-LD or a canonical goes through here
// so the site name, URL and publisher stay identical across the whole site.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://nseacademy.vitaldigitalmedia.net").replace(/\/$/, "");
export const SITE_NAME = "NSE Academy";
export const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb7NzBL7YSdAiq5Tiv07";

export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Cut at a word boundary so a meta description never ends mid-word. */
export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : cut.length).replace(/[,;:.\s-]+$/, "")}…`;
}

const ABBREVIATIONS = new Set(["no", "nos", "ltd", "plc", "inc", "co", "corp", "st", "mr", "mrs", "dr", "vs", "approx", "est"]);

/** First sentence of a description, up to a budget - used to lead meta descriptions with the answer. */
export function leadSentence(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  const end = /[.!?](?=\s+[A-Z0-9"'(]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = end.exec(t))) {
    const word = (t.slice(0, m.index).match(/([A-Za-z]+)$/)?.[1] ?? "").toLowerCase();
    if (m[0] === "." && ABBREVIATIONS.has(word)) continue;
    const first = t.slice(0, m.index + 1);
    return first.length <= max ? first : truncate(first, max);
  }
  return t.length <= max ? t : truncate(t, max);
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: ["NSE Digital Academy"],
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: abs("/icon.png"), width: 1024, height: 1024 },
    description:
      "NSE Academy is an independent investor-education platform for Kenyans investing on the Nairobi Securities Exchange: courses, a free investor-profile quiz, company profiles, calculators and a daily market report.",
    areaServed: { "@type": "Country", name: "Kenya" },
    parentOrganization: { "@type": "Organization", name: "Infinity Digital Works", url: "https://vitaldigitalmedia.net/infinity-digital-works/" },
    sameAs: [WHATSAPP_CHANNEL],
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: abs("/contact"), areaServed: "KE", availableLanguage: ["en"] },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: ["NSE Digital Academy"],
    url: SITE_URL,
    inLanguage: "en-KE",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: abs(t.path) })),
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

/** JSON for a <script type="application/ld+json">. `<` is escaped so CMS text can never close the tag early. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
