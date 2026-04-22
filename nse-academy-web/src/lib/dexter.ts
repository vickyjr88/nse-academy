export interface DexterProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  thumbnail: string | null;
  in_stock: boolean;
  is_digital: boolean;
  description: string;
  status: string;
}

export interface DexterStorefrontResponse {
  products: DexterProduct[];
  total: number;
}

const STOREFRONT_URL =
  "https://dexter-api.vitaldigitalmedia.net/api/products/storefront/51fe5af0-266b-419e-8559-3f0febcd74c4";

export async function getDigitalProducts(): Promise<DexterProduct[]> {
  try {
    const res = await fetch(STOREFRONT_URL, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json: DexterStorefrontResponse = await res.json();
    return (json.products ?? []).filter((p) => p.is_digital && p.status === "active");
  } catch {
    return [];
  }
}
