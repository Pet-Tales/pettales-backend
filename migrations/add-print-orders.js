/**
 * Migration script to add PrintOrder collection and indexes
 * Run this script after deploying the print order feature
 */

const mongoose = require("mongoose");
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

async function runMigration() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");

    const db = mongoose.connection.db;

    // Check if PrintOrder collection already exists
    const collections = await db.listCollections({ name: "printorders" }).toArray();
    
    if (collections.length > 0) {
      console.log("PrintOrder collection already exists, skipping creation");
    } else {
      console.log("Creating PrintOrder collection...");
      await db.createCollection("printorders");
      console.log("PrintOrder collection created successfully");
    }

    // Create indexes for PrintOrder collection
    console.log("Creating indexes for PrintOrder collection...");
    
    const printOrderCollection = db.collection("printorders");

    // Create indexes
    const indexes = [
      // Primary indexes for queries
      { key: { user_id: 1, created_at: -1 }, name: "user_id_created_at" },
      { key: { status: 1 }, name: "status_index" },
      { key: { book_id: 1 }, name: "book_id_index" },
      
      // Unique indexes
      { key: { lulu_print_job_id: 1 }, name: "lulu_print_job_id_unique", unique: true, sparse: true },
      { key: { external_id: 1 }, name: "external_id_unique", unique: true },
      
      // Compound indexes for efficient queries
      { key: { user_id: 1, status: 1 }, name: "user_status_index" },
      { key: { status: 1, created_at: -1 }, name: "status_created_at" },
      
      // Text search index for order search
      { key: { external_id: "text", "shipping_address.name": "text" }, name: "search_index" }
    ];

    for (const index of indexes) {
      try {
        await printOrderCollection.createIndex(index.key, {
          name: index.name,
          unique: index.unique || false,
          sparse: index.sparse || false,
        });
        console.log(`✓ Created index: ${index.name}`);
      } catch (error) {
        if (error.code === 85) {
          console.log(`⚠ Index ${index.name} already exists, skipping`);
        } else {
          console.error(`✗ Failed to create index ${index.name}:`, error.message);
        }
      }
    }

    // Verify indexes were created
    console.log("\nVerifying indexes...");
    const createdIndexes = await printOrderCollection.indexes();
    console.log("Current indexes on PrintOrder collection:");
    createdIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Add any missing fields to existing documents (if collection had data)
    console.log("\nChecking for existing documents to update...");
    const existingCount = await printOrderCollection.countDocuments();
    
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing documents`);
      
      // Update documents that might be missing new fields
      const updateResult = await printOrderCollection.updateMany(
        { retry_count: { $exists: false } },
        { 
          $set: { 
            retry_count: 0,
            error_message: null,
            tracking_info: {
              tracking_id: null,
              tracking_urls: [],
              carrier_name: null
            }
          }
        }
      );
      
      console.log(`Updated ${updateResult.modifiedCount} documents with missing fields`);
    } else {
      console.log("No existing documents found");
    }

    console.log("\n✅ Migration completed successfully!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Rollback function (if needed)
async function rollbackMigration() {
  try {
    console.log("Rolling back PrintOrder migration...");
    await mongoose.connect(MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // Drop the PrintOrder collection
    const collections = await db.listCollections({ name: "printorders" }).toArray();
    
    if (collections.length > 0) {
      await db.dropCollection("printorders");
      console.log("✅ PrintOrder collection dropped successfully");
    } else {
      console.log("PrintOrder collection does not exist");
    }
    
  } catch (error) {
    console.error("❌ Rollback failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Check command line arguments
const command = process.argv[2];

if (command === "rollback") {
  console.log("🔄 Starting rollback...");
  rollbackMigration();
} else {
  console.log("🚀 Starting migration...");
  runMigration();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠ Migration interrupted');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠ Migration terminated');
  await mongoose.disconnect();
  process.exit(0);
});
