const BaseModel = require('./BaseModel');

class SensorNode extends BaseModel {
    constructor() {
        super('sensor_nodes');
    }

    findByLocation(locationId) {
        return this.db.prepare('SELECT * FROM sensor_nodes WHERE location_id = ?').all(locationId);
    }

    updateStatus(id, status) {
        return this.update(id, { 
            status, 
            last_sync: new Date().toISOString() 
        });
    }
}

module.exports = new SensorNode();
