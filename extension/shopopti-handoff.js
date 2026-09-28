/* global chrome, URLSearchParams, window */

(() => {
  const params = new URLSearchParams(window.location.search);
  const handoffId = params.get('handoff');
  const requestedSource = params.get('source');

  if (
    !handoffId ||
    !['aliexpress', 'amazon'].includes(requestedSource || '') ||
    params.get('mode') !== 'extension'
  ) {
    return;
  }

  chrome.storage.local.get(['shopoptiPendingImport', 'shopoptiPendingImportId'], (result) => {
    const product = result.shopoptiPendingImport;
    if (
      result.shopoptiPendingImportId !== handoffId ||
      !product ||
      product.source !== requestedSource
    ) {
      return;
    }

    window.postMessage({
      source: 'shopopti-extension',
      type: 'SHOPOPTI_PRODUCT_HANDOFF',
      handoffId,
      product
    }, window.location.origin);

    chrome.storage.local.remove(['shopoptiPendingImport', 'shopoptiPendingImportId']);
  });
})();
