export interface ProductVariant {
  id?: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  currency?: string | null;
  sku?: string;
  stock?: number | null;
  availability?: string | null;
  images?: string[];
  options: Record<string, string>;
}

export interface ProductData {
  id?: string;
  title: string;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number | null;
  priceValidUntil?: string | null;
  currency?: string | null;
  gtin?: string | null;
  ean?: string | null;
  upc?: string | null;
  mpn?: string | null;
  images: string[];
  videos?: string[];
  variants?: ProductVariant[];
  sku?: string;
  stock?: number;
  availability?: string | null;
  category?: string;
  breadcrumbs?: string[];
  brand?: string;
  sellerDetails?: {
    name?: string | null;
    id?: string | null;
    url?: string | null;
    rating?: number | null;
    foundingDate?: string | null;
  };
  minimumOrderQuantity?: number | null;
  packSize?: number | null;
  canonicalUrl?: string | null;
  condition?: string | null;
  taxIncluded?: boolean | null;
  priceCountry?: string | null;
  soldCount?: number | null;
  model?: string;
  sourceKeywords?: string[];
  sourceTags?: string[];
  attributes?: Record<string, string>;
  weight?: number;
  weightUnit?: string;
  dimensions?: {
    length?: number | null;
    width?: number | null;
    height?: number | null;
    unit?: string | null;
  };
  shipping?: Array<{
    cost?: number | null;
    currency?: string | null;
    countries: string[];
    method?: string | null;
    carrier?: string | null;
    shipFrom?: string | null;
    freeShipping?: boolean | null;
    handlingDays?: { min?: number | null; max?: number | null; unit?: string | null };
    transitDays?: { min?: number | null; max?: number | null; unit?: string | null };
  }>;
  metadata?: Record<string, any>;
  seo?: {
    title: string;
    description: string;
    keywords: string[];
  };
  reviews?: ProductReview[];
}

export interface ProductReview {
  id?: string;
  rating: number;
  comment: string;
  author: string;
  date: string;
  verified: boolean;
  helpful?: number;
  purchasedVariant?: string;
  title?: string;
  country?: string;
  images?: string[];
  videos?: string[];
  source?: string;
  sourceUrl?: string;
}
