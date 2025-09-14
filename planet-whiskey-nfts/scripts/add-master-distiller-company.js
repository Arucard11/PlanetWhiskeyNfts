// Script to add Master Disteller Rewards company to database
// Uses the same connection pattern as update-company-name.js

const { MongoClient } = require('mongodb');

async function addMasterDistillerCompany() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Arucard:Jeffrey100@cluster0.jhhmvwx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB');

    const db = client.db();
    const companiesCollection = db.collection('companies');

    // Check if Master Disteller Rewards already exists
    const existingCompany = await companiesCollection.findOne({ name: 'Master Disteller Rewards' });
    
    if (existingCompany) {
      console.log('✅ Master Disteller Rewards company already exists!');
      console.log('📋 Company details:', {
        _id: existingCompany._id,
        name: existingCompany.name,
        description: existingCompany.description,
        createdAt: existingCompany.createdAt
      });
      
      // Show collections count
      const collectionsCollection = db.collection('nftcollections');
      const collectionsCount = await collectionsCollection.countDocuments({ 
        companyId: existingCompany._id.toString() 
      });
      console.log(`📊 This company has ${collectionsCount} NFT collections`);
      return;
    }

    // Check for old name and update if found
    const oldCompany = await companiesCollection.findOne({ name: 'Whiskey Hodler Rewards' });
    if (oldCompany) {
      console.log('🔄 Found old "Whiskey Hodler Rewards" company, updating to "Master Disteller Rewards"...');
      
      const updateResult = await companiesCollection.updateOne(
        { _id: oldCompany._id },
        { 
          $set: { 
            name: 'Master Disteller Rewards',
            description: 'NFT collections for WHISKEY token holders with special perks and free mints.',
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`✅ Successfully updated ${updateResult.modifiedCount} company record`);
      
      // Show collections count
      const collectionsCollection = db.collection('nftcollections');
      const collectionsCount = await collectionsCollection.countDocuments({ 
        companyId: oldCompany._id.toString() 
      });
      console.log(`📊 This company has ${collectionsCount} NFT collections`);
      return;
    }

    // Create new Master Disteller Rewards company
    console.log('➕ Creating new Master Disteller Rewards company...');
    
    const newCompany = {
      name: 'Master Disteller Rewards',
      description: 'NFT collections for WHISKEY token holders with special perks and free mints.',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const insertResult = await companiesCollection.insertOne(newCompany);
    
    console.log('🎉 Successfully created Master Disteller Rewards company!');
    console.log('📋 New company ID:', insertResult.insertedId);
    console.log('✅ Master Disteller Rewards company is ready for whiskey-gated collections!');
    
  } catch (error) {
    console.error('❌ Error adding Master Disteller Rewards company:', error);
  } finally {
    await client.close();
    console.log('🔐 Disconnected from MongoDB');
  }
}

// Run the script
addMasterDistillerCompany()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
