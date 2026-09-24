require('dotenv').config({ path: '../.env' });

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);

// The JSON file is a set of defaults for a fresh installation.  Content that
// has been saved through the admin panel is the source of truth once it exists.
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(defaults, saved) {
    if (!isPlainObject(defaults) || !isPlainObject(saved)) {
        // Arrays and primitive values are complete pieces of content. Keeping
        // the saved value prevents an import from silently deleting admin work.
        return saved === undefined ? defaults : saved;
    }

    const merged = { ...saved };

    for (const [key, defaultValue] of Object.entries(defaults)) {
        merged[key] = Object.prototype.hasOwnProperty.call(saved, key)
            ? mergeDefaults(defaultValue, saved[key])
            : defaultValue;
    }

    return merged;
}

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

        const collection = db.collection('site_data');
        const existing = await collection.findOne({ _id: 'content' });
        const replaceExisting = process.argv.includes('--replace');
        const activitiesOnly = process.argv.includes('--activities');
        const membersOnly = process.argv.includes('--members');

        if (activitiesOnly || membersOnly) {
            if (!existing) {
                throw new Error('Cannot import a single section because no site content exists yet. Run a full import first.');
            }

            const fieldsToUpdate = { version: data.version };
            if (activitiesOnly) fieldsToUpdate.activities = data.activities;
            if (membersOnly) fieldsToUpdate.members = data.members;

            await collection.updateOne(
                { _id: 'content' },
                { $set: fieldsToUpdate }
            );

            console.log(
                (activitiesOnly ? 'Activities' : '') +
                (activitiesOnly && membersOnly ? ' and ' : '') +
                (membersOnly ? 'Core Team members' : '') +
                ' imported from site.json. Other saved content was preserved.'
            );
            return;
        }

        // Normal imports seed an empty database or add only newly introduced
        // fields. Use --replace only when the explicit intention is to discard
        // all admin-managed content and restore data/site.json.
        const content = replaceExisting || !existing
            ? data
            : mergeDefaults(data, existing);

        await collection.replaceOne(
            { _id: 'content' },
            { _id: 'content', ...content },
            { upsert: true }
        );

        console.log(
            replaceExisting
                ? 'NSS site data replaced from site.json.'
                : existing
                    ? 'NSS defaults merged; admin-managed content was preserved.'
                    : 'NSS site data seeded successfully.'
        );

    } catch (error) {
        console.error('Import failed:');
        console.error(error);

    } finally {
        await client.close();
    }
}

importData();
