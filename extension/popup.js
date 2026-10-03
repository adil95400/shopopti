/* global chrome, crypto, document, URL */

const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const imageEl = document.getElementById('product-image');
const titleEl = document.getElementById('product-title');
const priceEl = document.getElementById('product-price');
const verificationEl = document.getElementById('verification');
const extractButton = document.getElementById('extract');
const openShopOptiButton = document.getElementById('open-shopopti');

let currentProduct = null;
let currentHandoffId = null;

const setStatus = (message) => {
  statusEl.textContent = message;
};

const formatPrice = (product) => {
  if (typeof product.price !== 'number') return 'Prix non vérifié';
  const currency = product.currency || '';
  return currency ? `${product.price} ${currency}` : `${product.price}`;
};

const renderProduct = (product) => {
  currentProduct = product;
  titleEl.textContent = product.title || 'Titre non vérifié';
  priceEl.textContent = formatPrice(product);

  if (product.images?.[0]) {
    imageEl.src = product.images[0];
    imageEl.alt = product.title || 'Produit';
    imageEl.classList.remove('hidden');
  } else {
    imageEl.removeAttribute('src');
    imageEl.alt = '';
    imageEl.classList.add('hidden');
  }

  const verified = product.extraction?.verifiedFields || {};
  const verifiedNames = Object.entries(verified)
    .filter(([, value]) => value)
    .map(([key]) => key);

  verificationEl.textContent = verifiedNames.length
    ? `Source ${product.source}. Champs détectés : ${verifiedNames.join(', ')}. Vérification humaine requise avant publication.`
    : 'Données non vérifiées. Vérification humaine requise avant publication.';

  previewEl.classList.remove('hidden');
};

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
};

const supportedSourceFromUrl = (value) => {
  try {
    const url = new URL(value);
    if (/\.aliexpress\.com$/i.test(url.hostname) && /\/item\//i.test(url.pathname)) return 'aliexpress';
    if (/\.amazon\.(com|fr|de|es|it|co\.uk)$/i.test(url.hostname)
      && /\/(dp|gp\/product)\/[A-Z0-9]{10}/i.test(url.pathname)) return 'amazon';
  } catch (_error) {
    return null;
  }
  return null;
};

extractButton.addEventListener('click', async () => {
  extractButton.disabled = true;
  previewEl.classList.add('hidden');
  currentProduct = null;
  currentHandoffId = null;
  setStatus('Analyse locale de la page…');

  try {
    const tab = await getActiveTab();
    const source = supportedSourceFromUrl(tab?.url || '');
    if (!tab?.id || !source) {
      throw new Error('Ouvre une fiche produit AliExpress ou Amazon prise en charge puis relance l’analyse.');
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOPOPTI_EXTRACT_PRODUCT'
    });

    if (!response?.ok || !response.product) {
      throw new Error(response?.error || 'Extraction fournisseur impossible.');
    }

    currentHandoffId = crypto.randomUUID();

    await chrome.storage.local.set({
      shopoptiPendingImport: response.product,
      shopoptiPendingImportId: currentHandoffId
    });

    renderProduct(response.product);
    setStatus(`Produit ${response.product.source} préparé localement.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue.';
    setStatus(message);
  } finally {
    extractButton.disabled = false;
  }
});

openShopOptiButton.addEventListener('click', async () => {
  if (!currentProduct) {
    setStatus('Aucun produit préparé.');
    return;
  }

  if (!currentHandoffId) {
    setStatus('Le transfert sécurisé a expiré. Relance l’analyse.');
    return;
  }

  const sourceUrl = encodeURIComponent(currentProduct.sourceUrl || '');
  const source = encodeURIComponent(currentProduct.source || '');
  const handoffId = encodeURIComponent(currentHandoffId);
  await chrome.tabs.create({
    url: `https://shopopti.io/import?source=${source}&mode=extension&handoff=${handoffId}&url=${sourceUrl}`
  });
});
