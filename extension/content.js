(() => {
  const cleanText = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const absoluteUrl = (value) => {
    if (!value) return null;
    try {
      return new URL(value, window.location.href).href;
    } catch {
      return null;
    }
  };

  const firstMeta = (...selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node?.getAttribute('content');
      if (value) return cleanText(value);
    }
    return '';
  };

  const readJsonLd = () => {
    const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')];
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block.textContent || 'null');
        const entries = Array.isArray(parsed) ? parsed : [parsed];
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const type = Array.isArray(entry['@type']) ? entry['@type'] : [entry['@type']];
          if (type.includes('Product')) return entry;
        }
      } catch {
        // Ignore malformed third-party JSON-LD and continue with safe fallbacks.
      }
    }
    return null;
  };

  const collectImages = (jsonLd) => {
    const values = new Set();

    const add = (value) => {
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      const url = absoluteUrl(value);
      if (url && /^https?:/.test(url)) values.add(url);
    };

    add(jsonLd?.image);
    add(firstMeta('meta[property="og:image"]', 'meta[name="twitter:image"]'));

    document.querySelectorAll('img').forEach((image) => {
      const src = image.currentSrc || image.getAttribute('src') || image.getAttribute('data-src');
      const url = absoluteUrl(src);
      if (!url) return;
      const rect = image.getBoundingClientRect();
      if (rect.width >= 120 && rect.height >= 120) values.add(url);
    });

    return [...values].slice(0, 30);
  };

  const normalizeOffer = (offers) => {
    if (Array.isArray(offers)) return offers[0] || {};
    return offers && typeof offers === 'object' ? offers : {};
  };

  const extractProduct = () => {
    if (!/\.aliexpress\.com$/i.test(window.location.hostname) || !/\/item\//i.test(window.location.pathname)) {
      return {
        ok: false,
        error: 'Cette page n’est pas une fiche produit AliExpress prise en charge.'
      };
    }

    const jsonLd = readJsonLd();
    const offer = normalizeOffer(jsonLd?.offers);

    const title = cleanText(
      jsonLd?.name ||
      firstMeta('meta[property="og:title"]', 'meta[name="twitter:title"]') ||
      document.querySelector('h1')?.textContent ||
      document.title
    );

    const description = cleanText(
      jsonLd?.description ||
      firstMeta('meta[property="og:description"]', 'meta[name="description"]')
    );

    const rawPrice =
      offer.price ||
      offer.lowPrice ||
      firstMeta('meta[property="product:price:amount"]', 'meta[itemprop="price"]');

    const price = rawPrice === undefined || rawPrice === null || rawPrice === ''
      ? null
      : Number.parseFloat(String(rawPrice).replace(',', '.'));

    const currency = cleanText(
      offer.priceCurrency ||
      firstMeta('meta[property="product:price:currency"]', 'meta[itemprop="priceCurrency"]')
    ) || null;

    const productIdMatch = window.location.pathname.match(/\/item\/(\d+)\.html/i);

    const payload = {
      schemaVersion: 1,
      source: 'aliexpress',
      sourceUrl: window.location.href,
      extractedAt: new Date().toISOString(),
      productId: productIdMatch?.[1] || null,
      title,
      description,
      price: Number.isFinite(price) ? price : null,
      currency,
      images: collectImages(jsonLd),
      availability: cleanText(offer.availability || '') || null,
      seller: null,
      variants: [],
      extraction: {
        method: jsonLd ? 'json-ld+dom-fallback' : 'dom-fallback',
        verifiedFields: {
          title: Boolean(title),
          price: Number.isFinite(price),
          currency: Boolean(currency),
          images: collectImages(jsonLd).length > 0
        }
      }
    };

    if (!payload.title) {
      return {
        ok: false,
        error: 'Le titre du produit n’a pas pu être extrait de manière fiable.'
      };
    }

    return { ok: true, product: payload };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SHOPOPTI_EXTRACT_PRODUCT') return;
    sendResponse(extractProduct());
  });
})();
