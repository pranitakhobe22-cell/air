const { getContainer } = require('../config/cosmosdb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { randomUUID } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'aeris-development-jwt-super-secret-key-please-change-in-prod';

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateAuthSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: z.string().email('Invalid email address').optional(),
    currentPassword: z.string().min(1, 'Current password is required to make changes'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').optional()
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const register = async (req, res) => {
    try {
        const { name, email, password } = registerSchema.parse(req.body);
        const users = await getContainer('users');

        // Check for duplicate email (partition-scoped query)
        const { resources } = await users.items.query(
            { query: 'SELECT c.id FROM c WHERE c.email = @email', parameters: [{ name: '@email', value: email }] },
            { partitionKey: email }
        ).fetchAll();

        if (resources.length > 0) {
            return res.status(400).json({ success: false, error: 'Email is already registered' });
        }

        const userId = randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);
        const now = new Date().toISOString();

        await users.items.create({ id: userId, email, name, passwordHash, createdAt: now, updatedAt: now });

        // Create default health profile
        const profiles = await getContainer('profiles');
        await profiles.items.create({
            id: userId, userId,
            age: 30, sensitivity: 'moderate', conditions: [],
            outdoorExposureHours: 2, gender: 'prefer_not_to_say', smoking: 'none',
            activityLevel: 'moderate', commuteMode: 'mixed', environment: 'suburban',
            createdAt: now, updatedAt: now,
        });

        const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            data: { id: userId, name, email },
        });
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', issues: e.errors });
        if (e.code === 404) return res.status(503).json({ success: false, error: 'Database containers not yet set up. Please create the users and profiles containers in Azure portal.' });
        console.error('Auth Register Error:', e);
        res.status(500).json({ success: false, error: 'Internal server error during registration' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const users = await getContainer('users');

        const { resources } = await users.items.query(
            { query: 'SELECT * FROM c WHERE c.email = @email', parameters: [{ name: '@email', value: email }] },
            { partitionKey: email }
        ).fetchAll();

        if (resources.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = resources[0];
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        return res.json({
            success: true,
            message: 'Login successful',
            token,
            data: { id: user.id, name: user.name, email: user.email },
        });
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', issues: e.errors });
        if (e.code === 404) return res.status(503).json({ success: false, error: 'Database containers not yet set up. Please create the users container in Azure portal.' });
        console.error('Auth Login Error:', e);
        res.status(500).json({ success: false, error: 'Internal server error during login' });
    }
};

const me = async (req, res) => {
    try {
        const { userId, email } = req.user;
        const users = await getContainer('users');
        const { resource } = await users.item(userId, email).read();

        if (!resource) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        return res.json({
            success: true,
            data: { id: resource.id, name: resource.name, email: resource.email, createdAt: resource.createdAt },
        });
    } catch (e) {
        console.error('Auth Me Error:', e);
        res.status(500).json({ success: false, error: 'Internal server error fetching profile' });
    }
};
const updateAccount = async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = updateAuthSchema.parse(req.body);
        const userId = req.user?.userId;
        const currentEmail = req.user?.email;

        if (!userId || !currentEmail) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const users = await getContainer('users');
        const { resource: user } = await users.item(userId, currentEmail).read();

        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        // Verify current password first
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) return res.status(401).json({ success: false, error: 'Incorrect current password' });

        // Check if new email already exists
        if (email && email !== currentEmail) {
            const { resources: existing } = await users.items.query(
                { query: 'SELECT c.id FROM c WHERE c.email = @email', parameters: [{ name: '@email', value: email }] },
                { partitionKey: email }
            ).fetchAll();
            if (existing.length > 0) return res.status(400).json({ success: false, error: 'Email already in use' });
        }

        // Apply updates
        if (name) user.name = name;
        if (newPassword) user.passwordHash = await bcrypt.hash(newPassword, 10);
        user.updatedAt = new Date().toISOString();

        // If email changed, we must re-create the document because 'email' is the partition key
        if (email && email !== currentEmail) {
            user.email = email;
            await users.items.create(user);
            await users.item(userId, currentEmail).delete();
        } else {
            await users.items.upsert(user);
        }

        res.status(200).json({
            success: true,
            data: { id: user.id, email: user.email, name: user.name },
            message: 'Account updated successfully'
        });
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: 'Validation failed', issues: e.errors });
        console.error('Auth Update Error:', e);
        res.status(500).json({ success: false, error: 'Internal server error updating account' });
    }
};

module.exports = { register, login, me, updateAccount };
