const db = require('../config/db');

class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    findAll() {
        return this.db.prepare(`SELECT * FROM ${this.tableName}`).all();
    }

    findById(id) {
        return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    }

    create(data) {
        const keys = Object.keys(data);
        const columns = keys.join(', ');
        const placeholders = keys.map(() => '?').join(', ');
        const values = Object.values(data);

        const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
        const info = this.db.prepare(sql).run(...values);
        
        return { id: data.id || info.lastInsertRowid, ...data };
    }

    update(id, data) {
        const keys = Object.keys(data);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];

        const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
        this.db.prepare(sql).run(...values);
        
        return this.findById(id);
    }

    delete(id) {
        return this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
    }
}

module.exports = BaseModel;
