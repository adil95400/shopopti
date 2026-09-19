Deno.serve(() => new Response(JSON.stringify({
  success: false,
  error: {
    code: 'LEGACY_SHOPIFY_ENDPOINT_DISABLED',
    message: 'This legacy Shopify endpoint is disabled. Use the canonical shopify Edge Function.',
  },
}), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}))
