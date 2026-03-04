const BaseModel = require('./BaseModel');

class Location extends BaseModel {
    constructor() {
        super('locations');
    }

    findByType(type) {
        return this.db.prepare('SELECT * FROM locations WHERE type = ?').all(type);
    }
}

module.exports = new Location();
