import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';
import './i18n';

const showStartupError = (title: string, detail: string) => {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <main style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;background:#f8fafc;color:#0f172a;padding:48px 24px;">
      <section style="max-width:920px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.08)">
        <div style="display:inline-flex;align-items:center;border-radius:999px;background:#fee2e2;color:#991b1b;padding:6px 10px;font-size:12px;font-weight:700;">ShopOpti staging diagnostics</div>
        <h1 style="margin:18px 0 8px;font-size:26px;">${title}</h1>
        <p style="margin:0 0 18px;color:#475569;">Le frontend n'a pas pu démarrer. Copiez ou photographiez le message ci-dessous.</p>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:16px;overflow:auto;font-size:13px;line-height:1.5;">${detail.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] ?? char))}</pre>
      </section>
    </main>`;
};

window.addEventListener('error', (event) => {
  const detail = [
    event.message || 'Unknown window error',
    event.filename ? `File: ${event.filename}` : '',
    event.lineno ? `Line: ${event.lineno}:${event.colno ?? 0}` : '',
    event.error?.stack || '',
  ].filter(Boolean).join('\n');

  showStartupError('Erreur JavaScript au démarrage', detail);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason =
    event.reason instanceof Error
      ? event.reason.stack || event.reason.message
      : String(event.reason ?? 'Unhandled promise rejection');

  showStartupError('Promesse rejetée au démarrage', reason);
});

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Missing #root element');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  const detail =
    error instanceof Error ? error.stack || error.message : String(error);
  showStartupError('Impossible de démarrer ShopOpti', detail);
}
