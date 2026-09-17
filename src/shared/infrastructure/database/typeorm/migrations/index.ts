import { CreateUsersTable1758067200000 } from './1758067200000-create-users-table.js';
import { CreateVouchersTable1758070800000 } from './1758070800000-create-vouchers-table.js';
import { CreateUsersVouchersTable1758074400000 } from './1758074400000-create-users-vouchers-table.js';

/**
 * Migrations are registered explicitly (instead of a glob) so they resolve the
 * same way when running from `dist` and when running the tests from TypeScript.
 */
export const migrations = [
  CreateUsersTable1758067200000,
  CreateVouchersTable1758070800000,
  CreateUsersVouchersTable1758074400000,
];
