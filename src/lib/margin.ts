export function computeMargin(msrp: number | undefined, price: number): number {
  if (!msrp || msrp === 0) return 0;

  const formula = (import.meta as any).env?.VITE_MARGIN_FORMULA as string | undefined;
  if (formula) {
    try {
      const fn = new Function('msrp', 'price', `return ${formula}`);
      const result = Number(fn(msrp, price));
      if (!isNaN(result)) {
        return result;
      }
    } catch (err) {
      console.warn('Invalid margin formula', err);
    }
  }

  return (msrp - price) / msrp;
}
