const { MongoClient } = require('mongodb');

async function updateCompanyName() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/planet-whiskey-nfts';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const companiesCollection = db.collection('companies');

    // Update any existing "Whiskey Hodler Rewards" to "Master Disteller Rewards"
    const result = await companiesCollection.updateMany(
      { name: 'Whiskey Hodler Rewards' },
      { 
        $set: { 
          name: 'Master Disteller Rewards',
          description: 'NFT collections for WHISKEY token holders with special perks and free mints.'
        } 
      }
    );

    console.log(`Updated ${result.modifiedCount} company records`);

    // Also check if there are any collections that might reference the old company
    const collectionsCollection = db.collection('nftcollections');
    const companies = await companiesCollection.find({ 
      $or: [
        { name: 'Master Disteller Rewards' },
        { name: 'Whiskey Hodler Rewards' }
      ]
    }).toArray();

    for (const company of companies) {
      const collectionsCount = await collectionsCollection.countDocuments({ 
        companyId: company._id.toString() 
      });
      console.log(`Company "${company.name}" (${company._id}) has ${collectionsCount} collections`);
    }

  } catch (error) {
    console.error('Error updating company name:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

updateCompanyName().catch(console.error);
