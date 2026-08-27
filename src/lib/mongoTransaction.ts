import type { ClientSession } from 'mongodb';
import clientPromise from '@/lib/mongodb';

/**
 * Run writes in a replica-set transaction (Atlas). Callers pass `{ session }`
 * into Mongo operations inside `fn`.
 */
export async function withMongoTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const client = await clientPromise;
  const session = client.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
