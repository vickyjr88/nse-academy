import OgImage from "@/app/p/[slug]/opengraph-image";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return OgImage({ params: { slug } });
}
