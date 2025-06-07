// dotenv and path imports, and dotenv.config() call are removed as it's handled by script preloading.

// Debug: Log the MONGODB_URI. This should now be populated by the preloaded dotenv/config.
console.log(`[DEBUG utils.ts] MONGODB_URI from process.env (after preload): ${process.env.MONGODB_URI}`);

// Now import modules that depend on environment variables
import dbConnect from './mongodb';
import NftCollection from '../models/NftCollection';

/**
 * Deletes all collections from the NftCollection collection in MongoDB.
 * WARNING: This is a destructive operation and cannot be undone.
 */
export async function deleteAllCollectionsFromDB(): Promise<void> {
  try {
    await dbConnect();
    console.log('Connected to MongoDB. Attempting to delete all collections...');

    const result = await NftCollection.deleteMany({});
    
    console.log(`Successfully deleted ${result.deletedCount} collections.`);
    if (result.deletedCount === 0) {
      console.log('No collections were found to delete.');
    }

  } catch (error) {
    console.error('Error deleting collections from MongoDB:', error);
    throw error; // Re-throw the error for the caller to handle if necessary
  } finally {
    // Consider whether to disconnect mongoose here or let the application manage connections.
    // For a standalone script, disconnecting might be appropriate:
    // await mongoose.disconnect();
    // console.log('Disconnected from MongoDB.');
  }
}

// Example of how you might call this function (e.g., in a script):

async function runDelete() {
  if (process.env.NODE_ENV !== 'development' && process.env.ALLOW_DESTRUCTIVE_OPERATIONS !== 'true') {
    console.error('ERROR: This script is destructive and should not be run in production unless explicitly allowed.');
    console.error('Set ALLOW_DESTRUCTIVE_OPERATIONS=true environment variable to run this script.');
    process.exit(1);
  }
  console.warn('WARNING: You are about to delete ALL collections from the database.');
  // Add a confirmation prompt or a delay here in a real script
  // For example, using readline or inquirer for a prompt.
  // For now, proceeding directly.
  
  try {
    await deleteAllCollectionsFromDB();
    console.log('Finished deleting collections.');
  } catch (e) {
    console.error('An error occurred during the delete operation.');
  }
  process.exit(0); // Ensure the script terminates
}

// To run this script, you might execute: ts-node path/to/this/utils.ts (after setting up ts-node)
// or call runDelete() from another script/file.
// If you uncomment and run the below, it will execute when the file is run directly.
runDelete(); 
