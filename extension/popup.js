const els = {
  status: document.getElementById('status'),
  unsupported: document.getElementById('unsupported'),
  productPanel: document.getElementById('product-panel'),
  errorPanel: document.getElementById('error-panel'),
  errorMessage: document.getElementById('error-message'),
  image: document.getElementById('product-image'),
  source: document.getElementById('product-source'),
  title: document.getElementById('product-title'),
  price: document.getElementById('product-price'),
  host: document.getElementById('source-host'),
  url: document.getElementById('source-url'),
  continueImport: document.getElementById('continue-import')
};

let product = null;

function setStatus(text, type) {
  els.status.textContent = text;
  els.status.className = 'status status-' + type;
}

function showOnly(target) {
  [els.unsupported, els.productPanel, els.errorPanel].forEach((el) => el.classList.add('hidden'));
  target.classList.remove('hidden');
}

function supplierFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    if (host.includes('aliexpress.')) return 'aliexpress';
    if (host.includes('amazon.')) return 'amazon';
  } catch {}
  return null;
}

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error('Onglet actif introuvable.');

    const supplier = supplierFromUrl(tab.url);
    if (!supplier) {
      setStatus('Non pris en charge', 'warn');
      showOnly(els.unsupported);
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SHOPOPTI_EXTRACT_PRODUCT' });
    if (!response?.ok || !response.product) {
      throw new Error(response?.error || 'Données produit indisponibles.');
    }

    product = response.product;
    setStatus('Produit détecté', 'ok');
    els.source.textContent = product.source || supplier;
    els.title.textContent = product.title || 'Produit détecté';
    els.price.textContent = product.priceText || '';
    els.host.textContent = new URL(product.url).hostname;
    els.url.textContent = product.url;

    if (product.image) {
      els.image.src = product.image;
      els.image.alt = product.title || 'Image produit';
      els.image.classList.remove('hidden');
    }

    showOnly(els.productPanel);
    await chrome.storage.local.set({ lastCapturedProduct: product });
  } catch (error) {
    setStatus('Erreur', 'error');
    els.errorMessage.textContent = error instanceof Error ? error.message : 'Erreur inconnue.';
    showOnly(els.errorPanel);
  }
}

els.continueImport.addEventListener('click', async () => {
  if (!product?.url) return;
  const params = new URLSearchParams({
    source: 'extension',
    method: 'url',
    supplier: product.source || '',
    url: product.url
  });
  const target = 'https://shopopti.io/#/app/import-products?' + params.toString();
  await chrome.tabs.create({ url: target });
});

init();