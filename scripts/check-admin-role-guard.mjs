// Frontend Admin authorization regression contract.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(resolve(baseDir, '..', path), 'utf8');

const routes = read('src/routes.tsx');
const roles = read('src/context/RoleContext.tsx');
const sidebar = read('src/components/layout/Sidebar.tsx');
const adminRoute = read('src/components/auth/AdminRoute.tsx');

const assertions = [
  [routes.includes('path="admin" element={<AdminRoute />}'), 'admin routes must use AdminRoute'],
  [roles.includes("supabase.rpc('get_current_user_role')"), 'role context must read the database-backed role'],
  [!roles.includes("email.includes('admin')"), 'role context must not infer admin from email'],
  [!roles.includes("email.includes('superadmin')"), 'role context must not infer superadmin from email'],
  [sidebar.includes('adminOnly: true'), 'admin navigation must be marked adminOnly'],
  [sidebar.includes('roleLoading && isAdmin'), 'admin navigation must fail closed while role is loading'],
  [adminRoute.includes('if (!isAdmin)'), 'AdminRoute must deny non-admin users'],
  [adminRoute.includes('to="/app/dashboard"'), 'AdminRoute must redirect denied users away from admin pages']
];

const failures = assertions.filter(([ok]) => !ok).map(([, message]) => message);

if (failures.length > 0) {
  console.error('Admin role guard contract failed:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Admin role guard contract passed.');
