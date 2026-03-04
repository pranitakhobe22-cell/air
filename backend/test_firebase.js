require('dotenv').config();
const { admin, db } = require('./config/firebase');

async function testFirebaseConnection() {
    console.log('Testing Firebase connection...');
    try {
        // Attempt to read a lightweight collection or check connection
        const snapshot = await db.collection('HardwareNodes').limit(1).get();
        console.log('✅ Firebase Admin SDK connected successfully!');
        console.log(`✅ Found ${snapshot.size} document(s) in 'HardwareNodes' collection.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Firebase connection failed:', error.message);
        process.exit(1);
    }
}

testFirebaseConnection();
