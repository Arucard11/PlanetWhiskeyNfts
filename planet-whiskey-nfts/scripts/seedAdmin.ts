/// <reference path="../additional.d.ts" />

import path from 'path';
import dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../.env.local');
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.error(`Error loading .env.local file from ${envPath}:`, dotenvResult.error);
  // Optionally, you could exit here if .env is critical
  // process.exit(1);
}

// For debugging, let's see what dotenv thinks it loaded (if anything)
// console.log('Dotenv loaded variables:', dotenvResult.parsed);
// console.log('Current MONGODB_URI after dotenv:', process.env.MONGODB_URI);
// console.log('Current ADMIN_USERNAME after dotenv:', process.env.ADMIN_USERNAME);

import bcrypt from 'bcryptjs';
import dbConnect from '../src/lib/mongodb';
import AdminUser from '../src/models/AdminUser';

const seedAdminUser = async () => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_DEFAULT_PASSWORD;

  if (!username || !password) {
    console.error(
      'Error: ADMIN_USERNAME and ADMIN_DEFAULT_PASSWORD must be defined. Check .env.local and dotenv loading.'
    );
    console.error(`Loaded ADMIN_USERNAME: ${username}`);
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error(
      'Error: MONGODB_URI must be defined. Check .env.local and dotenv loading.'
    );
    console.error(`Attempted to load .env.local from: ${envPath}`);
    process.exit(1);
  }

  await dbConnect();
  console.log('Connected to database.');

  const existingAdmin = await AdminUser.findOne({ username });

  if (existingAdmin) {
    console.log(`Admin user '${username}' already exists. Skipping seeding.`);
    process.exit(0);
    return;
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  console.log('Password hashed.');

  try {
    await AdminUser.create({
      username,
      passwordHash,
      role: 'admin', // Default role
    });
    console.log(`Admin user '${username}' created successfully!`);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
  process.exit(0);
};

seedAdminUser().catch((error) => {
  console.error('Unhandled error during admin seeding:', error);
  process.exit(1);
}); 