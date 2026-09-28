const supportedHosts = ['aliexpress.', 'amazon.'];

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  let supported = false;
  try {
    const host = new URL(tab.url).hostname;
    supported = supportedHosts.some((part) => host.includes(part));
  } catch {}

  chrome.action.setBadgeText({ tabId, text: supported ? '✓' : '' });
  if (supported) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
  }
});