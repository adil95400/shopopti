import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const inputPath = resolve(repoRoot, 'docs', 'openapi.json');
const outputDir = resolve(repoRoot, 'docs', 'api');
const outputPath = resolve(outputDir, 'index.html');

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const raw = await readFile(inputPath, 'utf8').catch((error) => {
  throw new Error(`OpenAPI schema not found at ${inputPath}: ${error.message}`);
});

let schema;
try {
  schema = JSON.parse(raw);
} catch (error) {
  throw new Error(`Invalid JSON in ${inputPath}: ${error.message}`);
}

if (!schema || typeof schema !== 'object') {
  throw new Error('OpenAPI schema must be a JSON object');
}
if (typeof schema.openapi !== 'string' || !schema.openapi.startsWith('3.')) {
  throw new Error(`Unsupported or missing OpenAPI version: ${schema.openapi ?? 'unknown'}`);
}
if (!schema.info || typeof schema.info !== 'object') {
  throw new Error('OpenAPI schema is missing info metadata');
}
if (!schema.paths || typeof schema.paths !== 'object') {
  throw new Error('OpenAPI schema is missing paths');
}

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
const endpoints = [];

for (const [path, pathItem] of Object.entries(schema.paths)) {
  if (!pathItem || typeof pathItem !== 'object') continue;

  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method.toLowerCase()) || !operation || typeof operation !== 'object') continue;

    endpoints.push({
      path,
      method: method.toUpperCase(),
      summary: operation.summary || operation.operationId || 'Sans résumé',
      description: operation.description || '',
      tags: Array.isArray(operation.tags) ? operation.tags : [],
      responses:
        operation.responses && typeof operation.responses === 'object'
          ? Object.keys(operation.responses)
          : [],
    });
  }
}

endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

const endpointHtml = endpoints.length
  ? endpoints.map((endpoint) => `
      <article class="endpoint">
        <div class="endpoint-heading">
          <span class="method">${escapeHtml(endpoint.method)}</span>
          <code>${escapeHtml(endpoint.path)}</code>
        </div>
        <h3>${escapeHtml(endpoint.summary)}</h3>
        ${endpoint.description ? `<p>${escapeHtml(endpoint.description)}</p>` : ''}
        ${endpoint.tags.length ? `<p><strong>Tags:</strong> ${endpoint.tags.map(escapeHtml).join(', ')}</p>` : ''}
        <p><strong>Réponses:</strong> ${endpoint.responses.length ? endpoint.responses.map(escapeHtml).join(', ') : 'Non documentées'}</p>
      </article>`).join('\n')
  : '<p>Aucun endpoint documenté.</p>';

const title = schema.info.title || 'ShopOpti API';
const version = schema.info.version || 'Non spécifiée';
const description = schema.info.description || '';

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Documentation API</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #10233f; background: #f7f9fc; }
    body { margin: 0; }
    main { max-width: 1100px; margin: 0 auto; padding: 48px 24px 72px; }
    header { margin-bottom: 32px; }
    h1 { margin: 0 0 8px; font-size: 2.2rem; }
    .meta { color: #5b6b82; }
    .endpoint { background: white; border: 1px solid #dbe3ee; border-radius: 14px; padding: 20px; margin: 14px 0; box-shadow: 0 4px 16px rgba(16, 35, 63, 0.05); }
    .endpoint-heading { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .method { font-weight: 800; font-size: 0.8rem; padding: 5px 8px; border-radius: 7px; background: #e8f0ff; color: #174ea6; }
    code { font-size: 0.95rem; }
    h3 { margin-bottom: 8px; }
    p { line-height: 1.55; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">OpenAPI ${escapeHtml(schema.openapi)} · Version API ${escapeHtml(version)} · ${endpoints.length} endpoint(s)</p>
      ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    </header>
    <section>
      <h2>Endpoints</h2>
      ${endpointHtml}
    </section>
  </main>
</body>
</html>
`;

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, html, 'utf8');

console.log(`API docs generated: ${outputPath} (${endpoints.length} endpoint(s))`);
