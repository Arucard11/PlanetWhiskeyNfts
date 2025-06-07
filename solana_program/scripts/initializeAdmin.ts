import * as anchor from "@coral-xyz/anchor";
import { BorshAccountsCoder } from "@coral-xyz/anchor"; // Only import what's needed for this test

async function testIdlProcessing() {
  console.log("Starting IDL processing test...");
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const idl = require('../target/idl/whiskeyprogram.json');
    
    if (!idl) {
      console.error("Failed to load IDL.");
      process.exit(1);
    }
    if (!idl.types || !Array.isArray(idl.types)) {
      console.error("IDL is missing 'types' array or it is not an array.");
      console.log("idl.types:", idl.types);
      process.exit(1);
    }
    if (!idl.accounts || !Array.isArray(idl.accounts)) {
        console.error("IDL is missing 'accounts' array or it is not an array.");
        console.log("idl.accounts:", idl.accounts);
        process.exit(1);
    }

    console.log("Original idl.types contents:");
    idl.types.forEach((t, index) => {
      console.log(`Original Type ${index}: name=${t.name}, type.kind=${t.type ? t.type.kind : 'N/A (type object missing)'}, type itself: ${t.type ? 'exists' : 'MISSING'}`);
    });

    // const cleanIdlTypes = JSON.parse(JSON.stringify(idl.types)); // Commented out
    // const sanitizedIdl = { ...idl, types: cleanIdlTypes }; // Commented out

    console.log("\nAttempting to create BorshAccountsCoder with original IDL...");
    // Directly use the original idl, assuming it's in the correct format
    const accountsCoder = new BorshAccountsCoder(idl as anchor.Idl);
    
    console.log("\nBorshAccountsCoder created successfully!");
    console.log("Test finished: IDL processing seems OK for BorshAccountsCoder.");

  } catch (error) {
    console.error("\nError during IDL processing test:", error);
    process.exit(1);
  }
}

testIdlProcessing().then(
  () => process.exit(0),
  (err) => {
    console.error("\nUnhandled error in test script execution:", err);
    process.exit(1);
  }
); 