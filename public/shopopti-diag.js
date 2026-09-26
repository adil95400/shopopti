(() => {
  const el = document.getElementById('shopopti-static-diagnostic');
  if (!el) return;
  el.innerHTML = '<strong>ShopOpti staging</strong><div style="margin-top:8px;color:#475569;">JavaScript statique chargé. Démarrage React…</div>';
  window.__SHOPOPTI_STATIC_JS_LOADED__ = true;
})();
