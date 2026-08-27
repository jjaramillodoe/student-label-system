import { MongoClient, type MongoClientOptions } from 'mongodb';

function requireMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please add your Mongo URI to .env.local');
  }
  return uri;
}

const options: MongoClientOptions = {
  // Fail faster than the driver default (30s) so API routes can surface errors cleanly
  serverSelectionTimeoutMS: 15_000,
  // Recycle idle sockets — important on Vercel warm lambdas
  maxIdleTimeMS: 60_000,
  maxPoolSize: 10,
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Connect with retryable caching.
 * If a previous connect() rejected (e.g. ReplicaSetNoPrimary / Atlas blip),
 * clear the cache so the next request can try again instead of reusing a
 * permanently failed Promise for the life of the serverless instance.
 */
function getClientPromise(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(requireMongoUri(), options);
    global._mongoClientPromise = client.connect().catch((err) => {
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

/**
 * Thenable that always resolves through getClientPromise().
 * Keeps `await clientPromise` / `clientPromise.then(...)` working everywhere
 * while still allowing reconnect after a failed attempt.
 */
const clientPromise = {
  then<TResult1 = MongoClient, TResult2 = never>(
    onfulfilled?: ((value: MongoClient) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return getClientPromise().then(onfulfilled, onrejected);
  },
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ) {
    return getClientPromise().catch(onrejected);
  },
  finally(onfinally?: (() => void) | null) {
    return getClientPromise().finally(onfinally ?? undefined);
  },
  [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;

export default clientPromise;
