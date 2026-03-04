const BaseModel = require('./BaseModel');

class Reading extends BaseModel {
    constructor() {
        super('sensor_readings');
    }

    findLatestByNode(nodeId) {
        return this.db.prepare('SELECT * FROM sensor_readings WHERE node_id = ? ORDER BY created_at DESC LIMIT 1').get(nodeId);
    }

    findHistoryByNode(nodeId, limit = 50) {
        return this.db.prepare('SELECT * FROM sensor_readings WHERE node_id = ? ORDER BY created_at DESC LIMIT ?').all(nodeId, limit);
    }
}

module.exports = new Reading();
