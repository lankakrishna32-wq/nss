require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);

async function importData() {
    try {
        await client.connect();

        console.log('MongoDB connected successfully');

        const db = client.db('nss_srgc');

        // Locate site.json
        const filePath = path.join(__dirname, '..', 'data', 'site.json');

        // Read site.json
        const data = JSON.parse(
            fs.readFileSync(filePath, 'utf8')
        );

        // Insert or update the content document
        await db.collection('site_data').replaceOne(
            { _id: 'content' },
            {
                _id: 'content',
                ...data
            },
            { upsert: true }
        );

        console.log('NSS site data imported successfully');

    } catch (error) {
        console.error('Import failed:');
        console.error(error);

    } finally {
        await client.close();
    }
}

importData();