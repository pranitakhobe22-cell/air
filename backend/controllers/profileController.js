const db = require('../utils/db');

const getProfile = async (req, res) => {
  try {
    // We are currently operating in a single-user system model for MVP
    // Fetch the first user document
    const usersRef = db.collection('users');
    const snapshot = await usersRef.limit(1).get();

    // Default response if no user exists in DB yet
    if (snapshot.empty) {
      return res.json({
        success: true,
        data: {
          name: 'Sarah Jenkins',
          age: 34,
          conditions: ['Asthma'],
          sensitivity: 'high'
        }
      });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Fetch the associated health profile
    const profileRef = db.collection('profiles').where('userId', '==', userDoc.id);
    const profileSnapshot = await profileRef.get();

    let profileData = null;
    if (!profileSnapshot.empty) {
      profileData = profileSnapshot.docs[0].data();
    }

    return res.json({
      success: true,
      data: {
        name: userData.name,
        age: profileData?.age || 30,
        conditions: typeof profileData?.conditions === 'string'
          ? JSON.parse(profileData.conditions)
          : profileData?.conditions || [],
        sensitivity: profileData?.sensitivity || 'moderate'
      }
    });
  } catch (e) {
    console.error("Profile Fetch Error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
};

module.exports = { getProfile };
