import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      return mongooseInstance.connection;
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    // Log the specific error and reset the promise to allow future retry attempts
    console.error("!!! MongoDB connection error in dbConnect !!!:", e);
    cached.promise = null; // Important to allow retrying connection on next call
    throw e; // Re-throw the error to be handled by the caller
  }
  return cached.conn;
}

export default dbConnect; 