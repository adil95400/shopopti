const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const imageEl = document.getElementById('product-image');
const titleEl = document.getElementById('product-title');
const priceEl = document.getElementById('product-price');
const verificationEl = document.getElementById('verification');
const extractButton = document.getElementById('extract');
const openShopOptiButton = document.getElementById('open-shopopti');

let currentProduct = null;

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
    imageEl.alt = product.title || 'Produit AliExpress';
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
    ? `Champs détectés : ${verifiedNames.join(', ')}. Vérification humaine requise avant publication.`
    : 'Données non vérifiées. Vérification humaine requise avant publication.';

  previewEl.classList.remove('hidden');
};

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
};

extractButton.addEventListener('click', async () => {
  extractButton.disabled = true;
  previewEl.classList.add('hidden');
  currentProduct = null;
  setStatus('Analyse locale de la page…');

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.includes('aliexpress.com/item/')) {
      throw new Error('Ouvre une fiche produit AliExpress puis relance l’analyse.');
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOPOPTI_EXTRACT_PRODUCT'
    });

    if (!response?.ok || !response.product) {
      throw new Error(response?.error || 'Extraction AliExpress impossible.');
    }

    await chrome.storage.local.set({
      shopoptiPendingImport: response.product
    });

    renderProduct(response.product);
    setStatus('Produit préparé localement.');
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

  const sourceUrl = encodeURIComponent(currentProduct.sourceUrl || '');
  await chrome.tabs.create({
    url: `https://shopopti.io/import?source=aliexpress&mode=extension&url=${sourceUrl}`
  });
});
