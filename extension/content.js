/* global chrome, document, URL, window */

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
    const products = [];
    const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')];

    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block.textContent || 'null');
        const entries = Array.isArray(parsed) ? parsed : [parsed];

        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const type = Array.isArray(entry['@type']) ? entry['@type'] : [entry['@type']];
          if (type.includes('ProductGroup')) return entry;
          if (type.includes('Product')) products.push(entry);
        }
      } catch {
        // Ignore malformed third-party JSON-LD.
      }
    }

    return products[0] || null;
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

  const entityName = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return cleanText(value) || null;
    if (typeof value === 'object') {
      const name = cleanText(value.name || value.legalName || '');
      return name || null;
    }
    return null;
  };

  const collectStructuredVariants = (jsonLd) => {
    if (!Array.isArray(jsonLd?.hasVariant)) return [];

    const optionFields = ['color', 'size', 'material', 'pattern', 'suggestedAge', 'suggestedGender'];

    return jsonLd.hasVariant.flatMap((variant) => {
      if (!variant || typeof variant !== 'object') return [];

      const variantOffer = normalizeOffer(variant.offers);
      const rawVariantPrice = variantOffer.price ?? variantOffer.lowPrice;
      const variantPrice = rawVariantPrice === undefined || rawVariantPrice === null || rawVariantPrice === ''
        ? null
        : Number.parseFloat(String(rawVariantPrice).replace(',', '.'));

      if (!Number.isFinite(variantPrice)) return [];

      const options = {};
      for (const field of optionFields) {
        const value = entityName(variant[field]);
        if (value) options[field] = value;
      }

      const title = cleanText(variant.name || Object.values(options).join(' / ')) || 'Variante';
      const sku = cleanText(variant.sku || variant.productID || '');

      return [{
        id: cleanText(variant['@id'] || '') || undefined,
        title,
        price: variantPrice,
        sku: sku || undefined,
        options
      }];
    });
  };

  const detectSource = () => {
    const host = window.location.hostname;
    if (/\.aliexpress\.com$/i.test(host)) return 'aliexpress';
    if (/\.amazon\.(com|fr|de|es|it|co\.uk)$/i.test(host)) return 'amazon';
    return null;
  };

  const extractAliExpress = () => {
    if (!/\/item\//i.test(window.location.pathname)) {
      return { ok: false, error: 'Cette page n’est pas une fiche produit AliExpress prise en charge.' };
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

    const seller = entityName(offer.seller || jsonLd?.seller);
    const images = collectImages(jsonLd);
    const variants = collectStructuredVariants(jsonLd);
    const productIdMatch = window.location.pathname.match(/\/item\/(\d+)\.html/i);

    const payload = {
      schemaVersion: 1,
      source: 'aliexpress',
      sourceUrl: window.location.href,
      extractedAt: new Date().toISOString(),
      productId: productIdMatch?.[1] || null,
      title,
      description,
      brand: entityName(jsonLd?.brand),
      price: Number.isFinite(price) ? price : null,
      currency,
      images,
      availability: cleanText(offer.availability || '') || null,
      seller,
      variants,
      extraction: {
        method: jsonLd ? 'json-ld+dom-fallback' : 'dom-fallback',
        verifiedFields: {
          title: Boolean(title),
          description: Boolean(description),
          brand: Boolean(entityName(jsonLd?.brand)),
          price: Number.isFinite(price),
          currency: Boolean(currency),
          images: images.length > 0,
          seller: Boolean(seller),
          variants: variants.length > 0
        }
      }
    };

    if (!payload.title) {
      return { ok: false, error: 'Le titre du produit n’a pas pu être extrait de manière fiable.' };
    }

    return { ok: true, product: payload };
  };

  const extractAmazon = () => {
    const path = window.location.pathname;
    const asinMatch = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (!asinMatch) {
      return { ok: false, error: 'Cette page n’est pas une fiche produit Amazon prise en charge.' };
    }

    const jsonLd = readJsonLd();
    const offer = normalizeOffer(jsonLd?.offers);
    const title = cleanText(
      document.querySelector('#productTitle')?.textContent ||
      jsonLd?.name ||
      firstMeta('meta[property="og:title"]') ||
      document.title
    );

    const description = cleanText(
      jsonLd?.description ||
      document.querySelector('#feature-bullets')?.textContent ||
      firstMeta('meta[name="description"]')
    );

    const rawPrice =
      offer.price ||
      firstMeta('meta[property="product:price:amount"]', 'meta[itemprop="price"]') ||
      document.querySelector('#corePrice_feature_div .a-offscreen')?.textContent ||
      document.querySelector('.a-price .a-offscreen')?.textContent ||
      '';

    const normalizedPrice = String(rawPrice).replace(/[^0-9,.-]/g, '').replace(',', '.');
    const price = normalizedPrice ? Number.parseFloat(normalizedPrice) : null;

    const currency = cleanText(
      offer.priceCurrency ||
      firstMeta('meta[property="product:price:currency"]', 'meta[itemprop="priceCurrency"]')
    ) || null;

    const seller = cleanText(
      document.querySelector('#merchant-info')?.textContent ||
      entityName(offer.seller || jsonLd?.seller) ||
      ''
    ) || null;

    const brand = cleanText(
      entityName(jsonLd?.brand) ||
      document.querySelector('#bylineInfo')?.textContent ||
      ''
    ) || null;

    const images = collectImages(jsonLd);
    const availability = cleanText(
      offer.availability ||
      document.querySelector('#availability')?.textContent ||
      ''
    ) || null;

    const payload = {
      schemaVersion: 1,
      source: 'amazon',
      sourceUrl: window.location.href,
      extractedAt: new Date().toISOString(),
      productId: asinMatch[1].toUpperCase(),
      title,
      description,
      brand,
      price: Number.isFinite(price) ? price : null,
      currency,
      images,
      availability,
      seller,
      variants: [],
      extraction: {
        method: jsonLd ? 'json-ld+amazon-dom-fallback' : 'amazon-dom-fallback',
        verifiedFields: {
          title: Boolean(title),
          description: Boolean(description),
          brand: Boolean(brand),
          price: Number.isFinite(price),
          currency: Boolean(currency),
          images: images.length > 0,
          seller: Boolean(seller),
          variants: false
        }
      }
    };

    if (!payload.title) {
      return { ok: false, error: 'Le titre du produit Amazon n’a pas pu être extrait de manière fiable.' };
    }

    return { ok: true, product: payload };
  };

  const extractProduct = () => {
    const source = detectSource();
    if (source === 'aliexpress') return extractAliExpress();
    if (source === 'amazon') return extractAmazon();
    return { ok: false, error: 'Cette page fournisseur n’est pas prise en charge.' };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SHOPOPTI_EXTRACT_PRODUCT') return;
    sendResponse(extractProduct());
  });
})();
