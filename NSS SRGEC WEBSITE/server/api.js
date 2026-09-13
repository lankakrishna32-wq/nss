const { getDB } = require('./db');

async function getSiteContent() {
    const db = getDB();

    const document = await db
        .collection('site_data')
        .findOne({ _id: 'content' });

    return document;
}

async function saveSiteContent(data) {
    const db = getDB();

    await db
        .collection('site_data')
        .replaceOne(
            { _id: 'content' },
            {
                _id: 'content',
                ...data
            },
            { upsert: true }
        );

    return await getSiteContent();
}


// ==========================================
// REGISTRATION APIs
// ==========================================

async function saveRegistration(data) {
    const db = getDB();

    const registration = {
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
    };

    const result = await db
        .collection('registrations')
        .insertOne(registration);

    return {
        ...registration,
        _id: result.insertedId
    };
}


async function getRegistrations() {
    const db = getDB();

    return await db
        .collection('registrations')
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
}


module.exports = {
    getSiteContent,
    saveSiteContent,
    saveRegistration,
    getRegistrations
};  