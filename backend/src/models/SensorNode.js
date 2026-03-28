const BaseModel = require('./BaseModel');
const { execute } = require('../config/db');

class SensorNode extends BaseModel {
    constructor() {
        super('sensor_nodes');
    }

    async findByLocation(locationId) {
        const result = await execute(
            `SELECT * FROM sensor_nodes WHERE location_id = :1`,
            [locationId]
        );
        return result.rows;
    }

    async updateStatus(id, status) {
        if (!['online', 'offline'].includes(status)) {
            throw new Error(`Invalid status "${status}". Must be "online" or "offline".`);
        }
        return this.update(id, {
            status,
            last_sync: new Date().toISOString()
        });
    }
}

module.exports = new SensorNode();

