import OgImage from "./opengraph-image";

export const runtime = "edge";
export const alt = "NSE Academy — Shared Investor Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage({ params }: { params: { slug: string } }) {
  return OgImage({ params });
}
