/* global chrome, window */

(() => {
  const params = new URLSearchParams(window.location.search);
  const handoffId = params.get('handoff');

  if (!handoffId || params.get('source') !== 'aliexpress' || params.get('mode') !== 'extension') {
    return;
  }

  chrome.storage.local.get(['shopoptiPendingImport', 'shopoptiPendingImportId'], (result) => {
    if (result.shopoptiPendingImportId !== handoffId || !result.shopoptiPendingImport) {
      return;
    }

    window.postMessage({
      source: 'shopopti-extension',
      type: 'SHOPOPTI_ALIEXPRESS_HANDOFF',
      handoffId,
      product: result.shopoptiPendingImport
    }, window.location.origin);

    chrome.storage.local.remove(['shopoptiPendingImport', 'shopoptiPendingImportId']);
  });
})();
