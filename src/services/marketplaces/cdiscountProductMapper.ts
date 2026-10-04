import type { CdiscountStockPriceInput } from './cdiscountOfferContract';

export type ShopOptiProductForCdiscount = {
  id?: string | number | null;
  title?: string | null;
  sku?: unknown;
  stock?: unknown;
  price?: unknown;
  ean?: unknown;
  gtin?: unknown;
  barcode?: unknown;
  metadata?: Record<string, unknown> | null;
};

export type CdiscountProductMappingError = {
  productId: string;
  title: string;
  code: 'MISSING_SKU' | 'MISSING_STOCK' | 'INVALID_STOCK' | 'MISSING_PRICE' | 'INVALID_PRICE';
  message: string;
};

export type CdiscountProductMappingResult =
  | { ok: true; offer: CdiscountStockPriceInput }
  | { ok: false; error: CdiscountProductMappingError };

function displayId(product: ShopOptiProductForCdiscount): string {
  if (product.id === null || product.id === undefined) return 'unknown';
  return String(product.id);
}

function displayTitle(product: ShopOptiProductForCdiscount): string {
  return product.title?.trim() || 'Produit sans titre';
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function mapShopOptiProductToCdiscountStockPrice(
  product: ShopOptiProductForCdiscount,
): CdiscountProductMappingResult {
  const productId = displayId(product);
  const title = displayTitle(product);
  const metadata = product.metadata ?? {};

  const reference = firstString([product.sku, metadata.sku]);
  if (!reference) {
    return {
      ok: false,
      error: {
        productId,
        title,
        code: 'MISSING_SKU',
        message: 'SKU manquant : Cdiscount exige une référence vendeur vérifiable.',
      },
    };
  }

  if (product.stock === null || product.stock === undefined || product.stock === '') {
    return {
      ok: false,
      error: {
        productId,
        title,
        code: 'MISSING_STOCK',
        message: 'Stock manquant : aucune valeur par défaut n’est inventée.',
      },
    };
  }

  const stock = finiteNumber(product.stock);
  if (stock === undefined) {
    return {
      ok: false,
      error: {
        productId,
        title,
        code: 'INVALID_STOCK',
        message: 'Stock invalide : la valeur ShopOpti n’est pas numérique.',
      },
    };
  }

  if (product.price === null || product.price === undefined || product.price === '') {
    return {
      ok: false,
      error: {
        productId,
        title,
        code: 'MISSING_PRICE',
        message: 'Prix manquant : aucune valeur par défaut n’est inventée.',
      },
    };
  }

  const priceTtc = finiteNumber(product.price);
  if (priceTtc === undefined) {
    return {
      ok: false,
      error: {
        productId,
        title,
        code: 'INVALID_PRICE',
        message: 'Prix invalide : la valeur ShopOpti n’est pas numérique.',
      },
    };
  }

  const ean = firstString([
    product.ean,
    product.gtin,
    product.barcode,
    metadata.ean,
    metadata.gtin,
    metadata.barcode,
  ]);

  return {
    ok: true,
    offer: {
      reference,
      ean,
      stock,
      priceTtc,
    },
  };
}

export function mapShopOptiProductsToCdiscountStockPrice(
  products: readonly ShopOptiProductForCdiscount[],
): { offers: CdiscountStockPriceInput[]; errors: CdiscountProductMappingError[] } {
  const offers: CdiscountStockPriceInput[] = [];
  const errors: CdiscountProductMappingError[] = [];

  for (const product of products) {
    const result = mapShopOptiProductToCdiscountStockPrice(product);
    if (result.ok) offers.push(result.offer);
    else errors.push(result.error);
  }

  return { offers, errors };
}
