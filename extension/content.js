/* global chrome, document, location, URL, Error */
function text(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const value = node?.textContent?.trim();
    if (value) return value;
  }
  return '';
}

function attr(selectors, name) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const value = node?.getAttribute(name);
    if (value) return value;
  }
  return '';
}

function absoluteUrl(value) {
  if (!value) return '';
  try {
    return new URL(value, location.href).href;
  } catch (_error) {
    return '';
  }
}

function extractAmazon() {
  return {
    source: 'amazon',
    url: location.href,
    title: text(['#productTitle', 'h1 span', '#title']),
    priceText: text([
      '#corePrice_feature_div .a-offscreen',
      '.a-price .a-offscreen',
      '#priceblock_ourprice',
      '#price_inside_buybox'
    ]),
    image: absoluteUrl(attr(['#landingImage', '#imgBlkFront', '#main-image'], 'src'))
  };
}

function extractAliExpress() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || '';
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  return {
    source: 'aliexpress',
    url: location.href,
    title: text(['h1[data-pl="product-title"]', 'h1']) || ogTitle,
    priceText: text(['[data-pl="product-price"]', '.product-price-value', 'div[class*="price"] span']),
    image: absoluteUrl(ogImage || attr(['img[class*="magnifier--image"]', 'img[class*="images--item"]'], 'src'))
  };
}

function extractProduct() {
  const host = location.hostname;
  if (host.includes('amazon.')) return extractAmazon();
  if (host.includes('aliexpress.')) return extractAliExpress();
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SHOPOPTI_EXTRACT_PRODUCT') return;
  try {
    const product = extractProduct();
    if (!product) {
      sendResponse({ ok: false, error: 'Fournisseur non pris en charge.' });
      return;
    }
    if (!product.title) {
      sendResponse({ ok: false, error: 'Titre produit introuvable. Rechargez la page puis réessayez.' });
      return;
    }
    sendResponse({ ok: true, product });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Extraction impossible.' });
  }
});