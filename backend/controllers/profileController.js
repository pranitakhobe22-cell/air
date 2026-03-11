const { getContainer } = require('../config/cosmosdb');

const getProfile = async (req, res) => {
    try {
        const { userId, email } = req.user;

        const [usersContainer, profilesContainer] = await Promise.all([
            getContainer('users'),
            getContainer('profiles'),
        ]);

        const { resource: user } = await usersContainer.item(userId, email).read();
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const { resource: profile } = await profilesContainer.item(userId, userId).read();

        return res.json({
            success: true,
            data: {
                name: user.name,
                email: user.email,
                age: profile?.age || 30,
                gender: profile?.gender || 'prefer_not_to_say',
                smoking: profile?.smoking || 'none',
                conditions: profile?.conditions || [],
                sensitivity: profile?.sensitivity || 'moderate',
                outdoorExposureHours: profile?.outdoorExposureHours || 2,
                activityLevel: profile?.activityLevel || 'moderate',
                commuteMode: profile?.commuteMode || 'mixed',
                environment: profile?.environment || 'suburban',
                phone: profile?.phone || '',
            },
        });
    } catch (e) {
        console.error('Profile Fetch Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { userId, email } = req.user;
        const { name, age, conditions, sensitivity, outdoorExposureHours, gender, smoking, activityLevel, commuteMode, environment, phone } = req.body;
        const now = new Date().toISOString();

        if (name) {
            const users = await getContainer('users');
            const { resource: user } = await users.item(userId, email).read();
            if (user) await users.items.upsert({ ...user, name, updatedAt: now });
        }

        const profiles = await getContainer('profiles');
        const { resource: existing } = await profiles.item(userId, userId).read();
        const base = existing || {
            id: userId, userId,
            age: 30, sensitivity: 'moderate', conditions: [],
            outdoorExposureHours: 2, gender: 'prefer_not_to_say', smoking: 'none',
            activityLevel: 'moderate', commuteMode: 'mixed', environment: 'suburban',
            createdAt: now,
        };

        const updated = {
            ...base,
            updatedAt: now,
            ...(age !== undefined && { age }),
            ...(conditions !== undefined && { conditions }),
            ...(sensitivity !== undefined && { sensitivity }),
            ...(outdoorExposureHours !== undefined && { outdoorExposureHours }),
            ...(gender !== undefined && { gender }),
            ...(smoking !== undefined && { smoking }),
            ...(activityLevel !== undefined && { activityLevel }),
            ...(commuteMode !== undefined && { commuteMode }),
            ...(environment !== undefined && { environment }),
            ...(phone !== undefined && { phone }),
        };

        await profiles.items.upsert(updated);

        return res.json({ success: true, message: 'Profile updated successfully' });
    } catch (e) {
        console.error('Profile Update Error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
};

module.exports = { getProfile, updateProfile };
