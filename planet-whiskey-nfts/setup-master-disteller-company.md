# Setup Master Distiller Rewards Company

This guide helps you set up the required "Master Distiller Rewards" company in your database.

## Quick Setup (MongoDB Shell/Compass)

```javascript
// Add the Master Distiller Rewards company to your database
db.companies.insertOne({
  name: "Master Distiller Rewards",
  description: "NFT collections for WHISKEY token holders with special perks and free mints.",
  createdAt: new Date(),
  updatedAt: new Date()
});
```

## Verification

```javascript
// Verify the company was created
db.companies.findOne({ name: "Master Distiller Rewards" });

// Should return something like:
// {
//   "_id": ObjectId("..."),
//   "name": "Master Distiller Rewards", 
//   "description": "NFT collections for WHISKEY token holders with special perks and free mints.",
//   "createdAt": ISODate("..."),
//   "updatedAt": ISODate("...")
// }
```

## What This Does

1. **Creates the required company** that all whiskey-gated collections will be assigned to
2. **Prevents duplicate companies** from being created
3. **Ensures consistent organization** of gated NFT collections
4. **Makes the Master Distiller Rewards section work** properly on the frontend

## After Setup

Once this company exists in your database:
- ✅ All whiskey-gated collections will be saved to this company
- ✅ They will appear in the "Master Distiller Rewards" section on the homepage  
- ✅ No duplicate companies will be created
- ✅ The system will work reliably

## Error Prevention

If you try to create a whiskey-gated collection without this company in the database, you'll get:
```
Master Distiller Rewards company not found. Please add it to the database first.
```

Just run the setup command above to fix it! 🥃✨
