// dotenv and path imports, and dotenv.config() call are removed as it's handled by script preloading.

// Debug: Log the MONGODB_URI. This should now be populated by the preloaded dotenv/config.
console.log(`[DEBUG utils.ts] MONGODB_URI from process.env (after preload): ${process.env.MONGODB_URI}`);

// Now import modules that depend on environment variables
import dbConnect from './mongodb';
import NftCollection from '../models/NftCollection';
import Company from '../models/Company';
import mongoose from 'mongoose';

/**
 * Deletes all collections from the NftCollection collection in MongoDB.
 * WARNING: This is a destructive operation and cannot be undone.
 */
export async function deleteAllCollectionsFromDB(): Promise<void> {
  console.log('WARNING: You are about to delete ALL collections from the database.');
  
  try {
    // dbConnect is now called from runDelete
    console.log('Attempting to delete all collections...');

    const deleteResult = await NftCollection.deleteMany({});
    
    console.log(`Successfully deleted ${deleteResult.deletedCount} collections.`);
    if (deleteResult.deletedCount === 0) {
      console.log('No collections were found to delete.');
    }

  } catch (error) {
    console.error('Error deleting collections from MongoDB:', error);
    throw error;
  }
}

export async function deleteAllCompaniesFromDB(): Promise<void> {
  console.log('WARNING: You are about to delete ALL companies from the database.');
  
  try {
    // dbConnect is now called from runDelete
    console.log('Attempting to delete all companies...');
    
    const deleteResult = await Company.deleteMany({});
    
    console.log(`Successfully deleted ${deleteResult.deletedCount} companies.`);
    if (deleteResult.deletedCount === 0) {
        console.log('No companies were found to delete.');
    }
  } catch (error) {
    console.error('Error deleting companies from MongoDB:', error);
    throw error;
  }
}

// Example of how you might call this function (e.g., in a script):

async function runDelete() {
  // Add a top-level try/catch for the whole process
  try {
    await dbConnect(); // Connect once at the beginning
    console.log('Connected to MongoDB.');

    await deleteAllCollectionsFromDB();
    await deleteAllCompaniesFromDB();

    console.log('Finished deleting collections and companies.');
  } catch (e) {
    console.error('An error occurred during the delete operation:', e);
    process.exit(1); // Exit with error code
  } finally {
    // Always try to disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

// To run this script, you might execute: ts-node path/to/this/utils.ts (after setting up ts-node)
// or call runDelete() from another script/file.
// If you uncomment and run the below, it will execute when the file is run directly.
runDelete(); 
