import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(baseDir, '..', path), 'utf8');

const page = read('src/pages/admin/Imports.tsx');
const service = read('src/services/adminImportsService.ts');
const edge = read('supabase/functions/admin-imports/index.ts');

const assertions = [
  [page.includes("adminImportsService"), 'Admin Imports must use adminImportsService'],
  [!page.includes("supplierService"), 'Admin Imports must not use legacy supplierService'],
  [!page.includes("external_suppliers"), 'Admin Imports must not reference external_suppliers'],
  [!page.includes("apiKey"), 'Admin Imports must not handle apiKey in the browser'],
  [!page.includes("apiSecret"), 'Admin Imports must not handle apiSecret in the browser'],
  [service.includes("supabase.functions.invoke('admin-imports'"), 'Admin Imports service must call admin-imports'],
  [edge.includes('.eq("role", "admin")'), 'admin-imports must re-check Admin role'],
  [edge.includes('credentialsIncluded: false'), 'admin-imports must declare credentials excluded'],
  [!edge.includes('credentials_encrypted"'), 'admin-imports must not select credentials_encrypted'],
  [!edge.includes('encrypted_credentials"'), 'admin-imports must not select encrypted_credentials'],
  [!edge.includes('api_key"'), 'admin-imports must not select api_key']
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);

if (failures.length > 0) {
  console.error('Admin Imports security contract failed:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Admin Imports security contract passed.');
