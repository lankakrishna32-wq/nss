const { ObjectId } = require('mongodb');
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
        status: 'pending',
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

async function reviewRegistration(id, status) {
    if (!['approved', 'rejected'].includes(status)) {
        throw new Error('Registration status must be approved or rejected');
    }

    if (!ObjectId.isValid(id)) {
        throw new Error('Invalid registration id');
    }

    const db = getDB();
    const registrationId = new ObjectId(id);
    const registration = await db
        .collection('registrations')
        .findOne({ _id: registrationId });

    if (!registration) {
        throw new Error('Registration not found');
    }

    const reviewedAt = new Date().toISOString();
    await db.collection('registrations').updateOne(
        { _id: registrationId },
        { $set: { status, reviewedAt } }
    );

    const contentCollection = db.collection('site_data');
    if (status === 'approved') {
        const volunteer = {
            registrationId: id,
            name: registration.name || '',
            phone: registration.phone || '',
            reason: registration.reason || '',
            registeredAt: registration.createdAt,
            approvedAt: reviewedAt
        };

        await contentCollection.updateOne(
            { _id: 'content', 'volunteers.registrationId': { $ne: id } },
            { $push: { volunteers: volunteer } }
        );
    } else {
        await contentCollection.updateOne(
            { _id: 'content' },
            { $pull: { volunteers: { registrationId: id } } }
        );
    }

    return {
        ...registration,
        status,
        reviewedAt
    };
}


async function getRegistrations() {
    const db = getDB();

    return await db
        .collection('registrations')
        .find({})
        .project({ 'aadhaarCard.data': 0 })
        .sort({ createdAt: -1 })
        .toArray();
}

async function getAadhaarCard(id) {
    if (!ObjectId.isValid(id)) {
        throw new Error('Invalid registration id');
    }

    const registration = await getDB()
        .collection('registrations')
        .findOne(
            { _id: new ObjectId(id), type: 'NSS Volunteer' },
            { projection: { aadhaarCard: 1 } }
        );

    if (!registration || !registration.aadhaarCard || !registration.aadhaarCard.data) {
        throw new Error('Aadhaar document not found');
    }

    return registration.aadhaarCard;
}


module.exports = {
    getSiteContent,
    saveSiteContent,
    saveRegistration,
    getRegistrations,
    getAadhaarCard,
    reviewRegistration
};
