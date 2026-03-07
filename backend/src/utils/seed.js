const Location = require('../models/Location');
const SensorNode = require('../models/SensorNode');

const seedData = async () => {
    try {
        console.log('🌱 [Seed] Populating initial demo data...');

        const locations = [
            { id: 'loc-industrial', name: 'Industrial Sector Alpha', type: 'industrial', lat: 19.076, lng: 72.877 },
            { id: 'loc-residential', name: 'Greenwood Residential',  type: 'residential', lat: 19.082, lng: 72.890 },
            { id: 'loc-transit',     name: 'Central Transit Hub',     type: 'transit',      lat: 19.070, lng: 72.865 },
        ];

        for (const loc of locations) {
            const existing = await Location.findById(loc.id);
            if (!existing) {
                await Location.create(loc);
                console.log(`✅ [Seed] Location created: ${loc.name}`);
            }
        }

        const nodes = [
            { id: 'node-01', location_id: 'loc-industrial',  status: 'online', last_sync: new Date().toISOString() },
            { id: 'node-02', location_id: 'loc-residential', status: 'online', last_sync: new Date().toISOString() },
            { id: 'node-03', location_id: 'loc-transit',     status: 'online', last_sync: new Date().toISOString() },
        ];

        for (const node of nodes) {
            const existing = await SensorNode.findById(node.id);
            if (!existing) {
                await SensorNode.create(node);
                console.log(`✅ [Seed] Node created: ${node.id}`);
            }
        }

        console.log('✨ [Seed] Seeding completed.');
    } catch (err) {
        console.error(`❌ [Seed] Error: ${err.message}`);
    }
};

module.exports = { seedData };
