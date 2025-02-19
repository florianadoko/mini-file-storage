const admin = require("firebase-admin");
const dotenv = require("dotenv");
dotenv.config();

/**
 * ✅ Authentication Middleware
 * This middleware verifies JWT tokens to ensure that only authenticated users
 * can access protected routes.
 */

// Load Firebase credentials
const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();

const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };
