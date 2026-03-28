const { execute } = require('../config/db');

const ALLOWED_TABLES = new Set([
    'locations', 'sensor_nodes', 'sensor_readings', 'user_profiles', 'alerts'
]);

class BaseModel {
    constructor(tableName) {
        if (!ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        this.tableName = tableName;
    }

    async findAll() {
        const result = await execute(`SELECT * FROM ${this.tableName}`);
        return result.rows;
    }

    async findById(id) {
        const result = await execute(
            `SELECT * FROM ${this.tableName} WHERE id = :1`,
            [id]
        );
        return result.rows[0] || null;
    }

    async create(data) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            throw new Error(`create() called with empty data on table "${this.tableName}"`);
        }
        const columns = keys.join(', ');
        const placeholders = keys.map((_, i) => `:${i + 1}`).join(', ');
        const values = Object.values(data);

        await execute(
            `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`,
            values
        );

        return { ...data };
    }

    async update(id, data) {
        const keys = Object.keys(data);
        if (keys.length === 0) {
            throw new Error(`update() called with empty data on table "${this.tableName}"`);
        }
        const setClause = keys.map((key, i) => `${key} = :${i + 1}`).join(', ');
        const values = [...Object.values(data), id];

        await execute(
            `UPDATE ${this.tableName} SET ${setClause} WHERE id = :${keys.length + 1}`,
            values
        );

        return this.findById(id);
    }

    async delete(id) {
        return execute(
            `DELETE FROM ${this.tableName} WHERE id = :1`,
            [id]
        );
    }
}

module.exports = BaseModel;

