const BaseModel = require('./BaseModel');
const { execute } = require('../config/db');

class Location extends BaseModel {
    constructor() {
        super('locations');
    }

    async findByType(type) {
        const result = await execute(
            `SELECT * FROM locations WHERE type = :1`,
            [type]
        );
        return result.rows;
    }
}

module.exports = new Location();

