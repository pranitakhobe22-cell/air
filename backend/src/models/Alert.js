const BaseModel = require('./BaseModel');
const { execute } = require('../config/db');

class Alert extends BaseModel {
    constructor() {
        super('alerts');
    }

    async findRecent(limit = 10) {
        const result = await execute(
            `SELECT * FROM alerts ORDER BY created_at DESC FETCH FIRST :1 ROWS ONLY`,
            [limit]
        );
        return result.rows;
    }
}

module.exports = new Alert();
