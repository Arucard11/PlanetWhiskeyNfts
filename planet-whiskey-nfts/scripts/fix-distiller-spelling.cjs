// Script to fix "Disteller" to "Distiller" spelling in database
const mongoose = require('mongoose');

async function fixDistillerSpelling() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://Arucard:Jeffrey100@cluster0.jhhmvwx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

  try {
    await mongoose.connect(uri);
    console.log('🔗 Connected to MongoDB');

    const companiesCollection = mongoose.connection.db.collection('companies');

    // Find the misspelled company
    const misspelledCompany = await companiesCollection.findOne({ name: 'Master Disteller Rewards' });
    
    if (misspelledCompany) {
      console.log('🔄 Found misspelled "Master Disteller Rewards", fixing to "Master Distiller Rewards"...');
      
      const updateResult = await companiesCollection.updateOne(
        { _id: misspelledCompany._id },
        { 
          $set: { 
            name: 'Master Distiller Rewards',
            description: 'NFT collections for WHISKEY token holders with special perks and free mints.',
            updatedAt: new Date()
          } 
        }
      );
      
      console.log(`✅ Successfully fixed spelling! Updated ${updateResult.modifiedCount} company record`);
      
      // Show collections count
      const collectionsCollection = mongoose.connection.db.collection('nftcollections');
      const collectionsCount = await collectionsCollection.countDocuments({ 
        companyId: misspelledCompany._id.toString() 
      });
      console.log(`📊 This company has ${collectionsCount} NFT collections`);
    } else {
      console.log('✅ No misspelled "Master Disteller Rewards" found');
      
      // Check if correctly spelled version exists
      const correctCompany = await companiesCollection.findOne({ name: 'Master Distiller Rewards' });
      if (correctCompany) {
        console.log('✅ Correctly spelled "Master Distiller Rewards" already exists!');
        
        const collectionsCollection = mongoose.connection.db.collection('nftcollections');
        const collectionsCount = await collectionsCollection.countDocuments({ 
          companyId: correctCompany._id.toString() 
        });
        console.log(`📊 This company has ${collectionsCount} NFT collections`);
      } else {
        console.log('❌ No "Master Distiller Rewards" company found at all!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing spelling:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔐 Disconnected from MongoDB');
  }
}

// Run the script
fixDistillerSpelling()
  .then(() => {
    console.log('✅ Spelling fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
