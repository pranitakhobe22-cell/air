const BaseModel = require('./BaseModel');

class Alert extends BaseModel {
    constructor() {
        super('alerts');
    }

    findRecent(limit = 10) {
        return this.db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?').all(limit);
    }
}

module.exports = new Alert();
