const admin = require('firebase-admin');
const path = require('path');

// Load service account key
// TODO: Place your serviceAccountKey.json in this directory
// Download from: Firebase Console → Project Settings → Service Accounts → Generate private key
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin SDK initialized successfully');
} catch (err) {
  console.error('❌ Failed to initialize Firebase Admin SDK.');
  console.error('   Make sure serviceAccountKey.json exists in the signaling-server/ directory.');
  console.error('   Download it from: Firebase Console → Project Settings → Service Accounts');
  process.exit(1);
}

module.exports = admin;
