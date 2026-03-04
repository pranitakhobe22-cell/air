const db = require('../utils/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const JWT_SECRET = process.env.JWT_SECRET || 'aeris-development-jwt-super-secret-key-please-change-in-prod';

// Zod schemas for validation
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const register = async (req, res) => {
  try {
    const parsedData = registerSchema.parse(req.body);

    const usersRef = db.collection('users');
    const existingSnapshot = await usersRef.where('email', '==', parsedData.email).limit(1).get();

    if (!existingSnapshot.empty) {
      return res.status(400).json({ success: false, error: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(parsedData.password, salt);

    // Create user
    const newUserRef = await usersRef.add({
      email: parsedData.email,
      name: parsedData.name,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create default health profile
    await db.collection('profiles').add({
      userId: newUserRef.id,
      age: 30,
      sensitivity: 'moderate',
      conditions: "[]",
      outdoorExposureHours: 2,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const token = jwt.sign({ userId: newUserRef.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      data: {
        id: newUserRef.id,
        name: parsedData.name,
        email: parsedData.email
      }
    });

  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', issues: e.errors });
    }
    console.error("Auth Register Error:", e);
    res.status(500).json({ success: false, error: 'Internal server error during registration' });
  }
};

const login = async (req, res) => {
  try {
    const parsedData = loginSchema.parse(req.body);

    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.where('email', '==', parsedData.email).limit(1).get();

    if (userSnapshot.empty) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const userDoc = userSnapshot.docs[0];
    const user = userDoc.data();

    const passwordMatch = await bcrypt.compare(parsedData.password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: userDoc.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: userDoc.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', issues: e.errors });
    }
    console.error("Auth Login Error:", e);
    res.status(500).json({ success: false, error: 'Internal server error during login' });
  }
};

const me = async (req, res) => {
  try {
    const userRef = db.collection('users').doc(req.user.userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userDoc.data();

    return res.json({
      success: true,
      data: {
        id: userDoc.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt ? user.createdAt.toDate() : new Date()
      }
    });
  } catch (e) {
    console.error("Auth Me Error:", e);
    res.status(500).json({ success: false, error: 'Internal server error fetching profile' });
  }
};

module.exports = { register, login, me };
