const BaseModel = require('./BaseModel');
const { execute } = require('../config/db');

class Reading extends BaseModel {
    constructor() {
        super('sensor_readings');
    }

    async findLatestByNode(nodeId) {
        const result = await execute(
            `SELECT * FROM sensor_readings WHERE node_id = :1
             ORDER BY created_at DESC FETCH FIRST 1 ROWS ONLY`,
            [nodeId]
        );
        return result.rows[0] || null;
    }

    async findHistoryByNode(nodeId, limit = 50) {
        const result = await execute(
            `SELECT * FROM sensor_readings WHERE node_id = :1
             ORDER BY created_at DESC FETCH FIRST :2 ROWS ONLY`,
            [nodeId, limit]
        );
        return result.rows;
    }
}

module.exports = new Reading();

