const { getContainer, isConfigured } = require('../../config/cosmosdb');

// Pure Cosmos DB Profile Model
// (Doesn't extend BaseModel to avoid SQLite schema conflicts)

class Profile {
    async findOrDefault(id) {
        if (!isConfigured()) return { id, userId: id, sensitivity: 'moderate' };

        try {
            const container = await getContainer('profiles');
            const { resource } = await container.item(id, id).read();
            if (resource) return resource;
        } catch (err) {
            console.log(`[Cosmos] Profile ${id} read error or not found:`, err.message);
        }

        return { id, userId: id, sensitivity: 'moderate' };
    }

    async update(id, data) {
        if (!isConfigured()) throw new Error('Cosmos DB is not configured');

        const container = await getContainer('profiles');

        // Ensure Cosmos DB requirements: id and partition key (userId)
        data.id = id;
        if (!data.userId) data.userId = id;

        const { resource } = await container.items.upsert(data);
        return resource;
    }

    async create(data) {
        if (!isConfigured()) throw new Error('Cosmos DB is not configured');

        const container = await getContainer('profiles');

        if (!data.userId) data.userId = data.id || 'default-user';
        if (!data.id) data.id = data.userId;

        const { resource } = await container.items.create(data);
        return resource;
    }

    async findById(id) {
        if (!isConfigured()) return null;
        try {
            const container = await getContainer('profiles');
            const { resource } = await container.item(id, id).read();
            return resource || null;
        } catch (e) { return null; }
    }

    async findAll() {
        if (!isConfigured()) return [];
        try {
            const container = await getContainer('profiles');
            const { resources } = await container.items.query('SELECT * FROM c').fetchAll();
            return resources;
        } catch (e) { return []; }
    }
}

module.exports = new Profile();
