export const CDISCOUNT_STOCK_PRICE_HEADERS = [
  'Votre référence',
  'EAN',
  'Stock',
  'Prix (€)(TTC)',
] as const;

export const CDISCOUNT_FULL_OFFER_HEADERS = [
  'Votre référence',
  'EAN/GTIN',
  'Sous-état du produit',
  'Stock',
  'Prix (TTC)',
  'TVA (%)',
  'Éco-participation (montant)',
  'DEA (montant)\n(France)',
  'Copie Privée (montant) \n(France)',
  'Chemical Tax \n(montant) (Suède)',
  'Conditionnement :\nQuantité totale vendue \n(Disponible uniquement sur Cdiscount)',
  'Conditionnement :\nUnité de vente \n(Disponible uniquement sur Cdiscount)',
  'Prix barré (TTC)',
  'Commentaire offre (Disponible uniquement sur Cdiscount)',
  'Activer les soldes (obligatoire)',
  'Début (facultatif) - Date (jj/mm/aaaa)',
  'Début (facultatif) - Heure (hh:mm)',
  'Fin (facultatif) - Date (jj/mm/aaaa)',
  'Fin (facultatif) - Heure (hh:mm)',
  'Remise en % (obligatoire)',
  'Prix de référence – utilisé pour le calcul du prix soldé (obligatoire)',
  'Activer la concurrence prix (obligatoire)',
  'Prix plancher (TTC – hors frais de port)',
  'Délai de préparation\n(nb jours ouvrés max)',
  'Suivi (1) - Principal',
  'Suivi (1) - Additionnel Facultatif',
  'Recommandé (1) - Principal',
  'Recommandé (1) - Additionnel Facultatif',
] as const;

export type CdiscountStockPriceInput = {
  reference: string;
  ean?: string | null;
  stock: number;
  priceTtc: number;
};

export type CdiscountValidationError = {
  field: keyof CdiscountStockPriceInput;
  code: string;
  message: string;
};

export type CdiscountValidationResult =
  | { ok: true; row: [string, string, string, string] }
  | { ok: false; errors: CdiscountValidationError[] };

const REFERENCE_MAX_LENGTH = 50;
const EAN_LENGTH = 13;
const STOCK_MAX_DIGITS = 10;

const decimalComma = (value: number): string => value.toFixed(2).replace('.', ',');

export function validateAndBuildCdiscountStockPriceRow(
  input: CdiscountStockPriceInput,
): CdiscountValidationResult {
  const errors: CdiscountValidationError[] = [];
  const reference = input.reference.trim();
  const ean = input.ean?.trim() ?? '';

  if (reference.length < 1 || reference.length > REFERENCE_MAX_LENGTH) {
    errors.push({
      field: 'reference',
      code: 'INVALID_REFERENCE_LENGTH',
      message: 'Votre référence doit contenir entre 1 et 50 caractères.',
    });
  }

  if (reference.includes('|')) {
    errors.push({
      field: 'reference',
      code: 'INVALID_REFERENCE_CHARACTER',
      message: 'Votre référence ne doit pas contenir le caractère "|".',
    });
  }

  if (ean && !/^\d{13}$/.test(ean)) {
    errors.push({
      field: 'ean',
      code: 'INVALID_EAN',
      message: 'EAN doit contenir exactement 13 chiffres lorsqu’il est renseigné.',
    });
  }

  if (!Number.isInteger(input.stock) || input.stock < 0 || String(input.stock).length > STOCK_MAX_DIGITS) {
    errors.push({
      field: 'stock',
      code: 'INVALID_STOCK',
      message: 'Stock doit être un entier positif ou nul sur 10 chiffres maximum.',
    });
  }

  if (!Number.isFinite(input.priceTtc) || input.priceTtc <= 1 || input.priceTtc >= 10_000_000_000) {
    errors.push({
      field: 'priceTtc',
      code: 'INVALID_PRICE',
      message: 'Prix TTC doit être supérieur à 1 € et respecter la taille du modèle Cdiscount.',
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    row: [reference, ean, String(input.stock), decimalComma(input.priceTtc)],
  };
}

export function assertCdiscountStockPriceHeaders(headers: readonly unknown[]): void {
  if (
    headers.length !== CDISCOUNT_STOCK_PRICE_HEADERS.length ||
    headers.some((value, index) => value !== CDISCOUNT_STOCK_PRICE_HEADERS[index])
  ) {
    throw new Error('CDISCOUNT_STOCK_PRICE_TEMPLATE_MISMATCH');
  }
}
