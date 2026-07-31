import { type EmptyRelations, sql } from "drizzle-orm";
import { drizzle, type NodePgTransaction } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

export type Database = ReturnType<typeof createDatabase>["db"];
export type RlsTransaction = NodePgTransaction<EmptyRelations>;
export type DatabaseRole =
  | "arise_app_user"
  | "arise_app_faculty"
  | "arise_app_counselor"
  | "arise_app_registrar"
  | "arise_app_dean"
  | "arise_app_service"
  | "arise_app_auditor"
  | "arise_app_admin";

export type RlsContext = {
  userAccountId: string;
  databaseRole: DatabaseRole;
  personId?: string;
  studentId?: string;
  employeeId?: string;
};

let defaultDatabase: Database | undefined;
let defaultAuthDatabase: Database | undefined;

export function createDatabase(config: PoolConfig = {}) {
  const connectionString = config.connectionString ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create the database client");
  }

  const pool = new Pool({
    ...config,
    connectionString,
    max: config.max ?? 10,
    idleTimeoutMillis: config.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5_000,
  });

  return {
    db: drizzle({ client: pool }),
    pool,
  };
}

export function getDatabase() {
  defaultDatabase ??= createDatabase().db;
  return defaultDatabase;
}

export function getAuthDatabase() {
  defaultAuthDatabase ??= createDatabase({
    connectionString: process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL,
  }).db;
  return defaultAuthDatabase;
}

export async function withRlsContext<T>(
  database: Database,
  context: RlsContext,
  work: (transaction: RlsTransaction) => Promise<T>,
) {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      set local role ${sql.raw(context.databaseRole)}
    `);
    await transaction.execute(sql`
      select
        set_config('app.user_account_id', ${context.userAccountId}, true),
        set_config('app.person_id', ${context.personId ?? ""}, true),
        set_config('app.student_id', ${context.studentId ?? ""}, true),
        set_config('app.employee_id', ${context.employeeId ?? ""}, true)
    `);

    return work(transaction);
  });
}

export async function withAuthBootstrap<T>(
  database: Database,
  work: (transaction: RlsTransaction) => Promise<T>,
) {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`
      set local role arise_app_service
    `);

    return work(transaction);
  });
}
