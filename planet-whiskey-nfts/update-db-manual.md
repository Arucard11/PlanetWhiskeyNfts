# Manual Database Update Commands

Since the npm script isn't working, you can update the database manually using MongoDB shell or a MongoDB client.

## Option 1: Using MongoDB Compass or Shell

```javascript
// Connect to your MongoDB database
// Then run these commands:

// Update company name
db.companies.updateMany(
  { name: "Whiskey Hodler Rewards" },
  { 
    $set: { 
      name: "Master Disteller Rewards",
      description: "NFT collections for WHISKEY token holders with special perks and free mints."
    } 
  }
);

// Check the results
db.companies.find({ 
  $or: [
    { name: "Master Disteller Rewards" },
    { name: "Whiskey Hodler Rewards" }
  ]
});
```

## Option 2: Using Node.js directly

If you have Node.js access to your database, you can run:

```bash
node -e "
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient('mongodb://localhost:27017/planet-whiskey-nfts');
  await client.connect();
  const db = client.db();
  const result = await db.collection('companies').updateMany(
    { name: 'Whiskey Hodler Rewards' },
    { \$set: { name: 'Master Disteller Rewards', description: 'NFT collections for WHISKEY token holders with special perks and free mints.' } }
  );
  console.log('Updated', result.modifiedCount, 'records');
  await client.close();
})();
"
```

## What this does:
- Finds any companies named "Whiskey Hodler Rewards"
- Renames them to "Master Disteller Rewards"
- Updates their description
- This ensures gated NFTs go to the correct section
