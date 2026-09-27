const { ObjectId } = require('mongodb');
const { getDB } = require('./db');
const defaultSiteContent = require('../data/site.json');

async function getSiteContent() {
    const db = getDB();

    const [document, approvedRegistrations] = await Promise.all([
        db.collection('site_data').findOne({ _id: 'content' }),
        db.collection('registrations')
            .find({ type: 'NSS Volunteer', status: 'approved' })
            .project({ 'aadhaarCard.data': 0 })
            .toArray()
    ]);

    const content = document || defaultSiteContent;
    const volunteers = Array.isArray(content.volunteers) ? [...content.volunteers] : [];
    const knownRegistrationIds = new Set(
        volunteers.map(volunteer => volunteer && volunteer.registrationId).filter(Boolean).map(String)
    );

    approvedRegistrations.forEach(registration => {
        const registrationId = String(registration._id);
        if (knownRegistrationIds.has(registrationId)) return;

        volunteers.push({
            registrationId,
            name: registration.name || registration.fullName || '',
            phone: registration.phone || '',
            reason: registration.reason || '',
            registeredAt: registration.createdAt,
            approvedAt: registration.reviewedAt
        });
        knownRegistrationIds.add(registrationId);
    });

    return {
        ...content,
        volunteers,
        volunteerCount: volunteers.length
    };
}

async function saveSiteContent(data) {
    const db = getDB();
    const content = { ...data };
    delete content.volunteerCount;

    await db
        .collection('site_data')
        .replaceOne(
            { _id: 'content' },
            {
                _id: 'content',
                ...content
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
