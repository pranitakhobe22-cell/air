/**
 * AERIS – Mock Database Engine (Extended)
 * ────────────────────────────────────────────────────────────────
 * Fallback in-memory database to ensure the demo is 100% functional
 * even if local Prisma/PostgreSQL environments are unstable.
 */

const bcrypt = require('bcryptjs');

let nodes = [
  {
    id: 'default-node-01',
    name: 'Alpha-Primary-Station',
    type: 'outdoor',
    status: 'active',
    battery: 95,
    lat: 19.076,
    lng: 72.877,
    lastPing: new Date()
  }
];

let users = [
  {
    id: 'user-01',
    email: 'test@aeris.ai',
    name: 'Sarah Jenkins',
    passwordHash: bcrypt.hashSync('password123', 10),
    healthProfile: {
      age: 28,
      sensitivity: 'moderate',
      outdoorExposureHours: 4,
      conditions: JSON.stringify(['Asthma'])
    }
  }
];

let readings = [];
let alerts = [];
let forecasts = [];

// Seed initial readings
const now = new Date();
for (let i = 48; i >= 0; i--) {
  const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000);
  readings.push({
    id: `r-${i}`,
    timestamp,
    pm25: 12 + Math.random() * 20,
    pm10: 20 + Math.random() * 30,
    co: 0.4 + Math.random() * 0.5,
    nox: 15 + Math.random() * 10,
    o3: 28 + Math.random() * 15,
    vocIndex: 45 + Math.random() * 30,
    temperature: 28 + Math.random() * 5,
    humidity: 55 + Math.random() * 10,
    oxygen: 20.9,
    pressure: 1013,
    aqi: 40 + Math.floor(Math.random() * 30),
    rri: 25 + Math.floor(Math.random() * 20),
    nodeId: 'default-node-01'
  });
}

const mockDb = {
  node: {
    findMany: async () => nodes,
    findUnique: async ({ where }) => nodes.find(n => n.id === where.id),
    findFirst: async () => nodes[0],
    update: async ({ where, data }) => {
       const idx = nodes.findIndex(n => n.id === where.id);
       if (idx !== -1) nodes[idx] = { ...nodes[idx], ...data };
       return nodes[idx];
    },
    upsert: async ({ where, update, create }) => {
       const idx = nodes.findIndex(n => n.id === where.id);
       if (idx !== -1) {
          nodes[idx] = { ...nodes[idx], ...update };
          return nodes[idx];
       } else {
          const nn = { ...create, lastPing: new Date() };
          nodes.push(nn);
          return nn;
       }
    }
  },
  user: {
    findUnique: async ({ where }) => users.find(u => u.email === where.email || u.id === where.id || u.email === where.email),
    findFirst: async ({ include }) => users[0],
    findMany: async () => users,
    upsert: async ({ where, update, create }) => {
       const idx = users.findIndex(u => u.email === where.email);
       if (idx !== -1) {
          users[idx] = { ...users[idx], ...update };
          return users[idx];
       } else {
          users.push(create);
          return create;
       }
    },
    create: async ({ data }) => {
      const newUser = { id: `u-${Date.now()}`, ...data };
      users.push(newUser);
      return newUser;
    }
  },
  environmentReading: {
    findMany: async (query) => {
      let res = [...readings];
      if (query?.where?.nodeId) res = res.filter(r => r.nodeId === query.where.nodeId);
      if (query?.where?.timestamp?.lt) res = res.filter(r => r.timestamp < query.where.timestamp.lt);
      
      if (query?.orderBy?.timestamp === 'desc') res.sort((a,b) => b.timestamp - a.timestamp);
      if (query?.take) res = res.slice(0, query.take);
      
      if (query?.include?.node) {
        res = res.map(r => ({ ...r, node: nodes.find(n => n.id === r.nodeId) }));
      }
      return res;
    },
    findFirst: async (query) => {
      let res = [...readings];
      if (query?.where?.nodeId) res = res.filter(r => r.nodeId === query.where.nodeId);
      if (query?.where?.timestamp?.lt) res = res.filter(r => r.timestamp < query.where.timestamp.lt);

      if (query?.orderBy?.timestamp === 'desc') res.sort((a,b) => b.timestamp - a.timestamp);
      
      let item = res[0];
      if (item && query?.include?.node) {
        const node = nodes.find(n => n.id === item.nodeId);
        item = { ...item, node: node || nodes[0] }; // Fail-safe to first node if ID mismatch
      }
      return item;
    },
    create: async ({ data }) => {
      const nr = { id: `r-${Date.now()}`, timestamp: new Date(), ...data };
      readings.push(nr);
      return nr;
    },
    createMany: async ({ data }) => {
       const nrs = data.map(d => ({ id: `r-${Date.now()}-${Math.random()}`, timestamp: new Date(), ...d }));
       readings.push(...nrs);
       return { count: nrs.length };
    },
    deleteMany: async () => { readings = []; }
  },
  alert: {
    findMany: async (query) => {
      let res = [...alerts];
      if (query?.where?.resolved === false) res = res.filter(a => !a.resolved);
      return res;
    },
    create: async ({ data }) => {
       const na = { id: `a-${Date.now()}`, timestamp: new Date(), ...data };
       alerts.push(na);
       return na;
    }
  },
  forecast: {
    findMany: async () => forecasts,
    findFirst: async () => forecasts[0],
    createMany: async ({ data }) => {
      forecasts = data.map(f => ({ id: `f-${Math.random()}`, ...f }));
      return { count: forecasts.length };
    },
    deleteMany: async () => { forecasts = []; }
  },
  $connect: async () => { console.log('Mock DB Connected'); return true; },
  $disconnect: async () => {}
};

module.exports = mockDb;
