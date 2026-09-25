import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(baseDir, '..', path), 'utf8');

const edge = read('supabase/functions/admin-ops/index.ts');
const page = read('src/pages/admin/Operations.tsx');
const service = read('src/services/adminOpsService.ts');

const assertions = [
  [edge.includes('.eq("role", "admin")'), 'admin-ops must re-check Admin role'],
  [edge.includes('"replay_import_pipeline"'), 'admin-ops must expose replay_import_pipeline mode'],
  [edge.includes('"retry_sync_queue"'), 'admin-ops must expose retry_sync_queue mode'],
  [edge.includes('"replay_import_pipeline_job"'), 'import replay must use canonical replay RPC'],
  [edge.includes('.eq("status", "failed")'), 'sync retry must require failed status'],
  [!edge.includes('sync-platforms'), 'admin-ops must not call legacy sync-platforms'],
  [!edge.includes('sync-products'), 'admin-ops must not call legacy sync-products'],
  [page.includes("label: 'Import DLQ'"), 'Operations page must surface import dead-letter queue'],
  [page.includes('retrySync(item.id)'), 'Operations page must expose guarded sync retry'],
  [page.includes('replayImport(item.job_id)'), 'Operations page must expose guarded import replay'],
  [service.includes("mode: 'replay_import_pipeline'"), 'service must invoke replay_import_pipeline'],
  [service.includes("mode: 'retry_sync_queue'"), 'service must invoke retry_sync_queue']
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);

if (failures.length > 0) {
  console.error('Admin Operations action contract failed:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Admin Operations action contract passed.');
