import { type EmptyRelations, sql } from "drizzle-orm";
import { drizzle, type NodePgTransaction } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

export type Database = ReturnType<typeof createDatabase>["db"];
export type RlsTransaction = NodePgTransaction<EmptyRelations>;

export type RlsContext = {
  userAccountId: string;
  personId?: string;
  studentId?: string;
  employeeId?: string;
};

let defaultDatabase: Database | undefined;

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

export async function withRlsContext<T>(
  database: Database,
  context: RlsContext,
  work: (transaction: RlsTransaction) => Promise<T>,
) {
  return database.transaction(async (transaction) => {
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
