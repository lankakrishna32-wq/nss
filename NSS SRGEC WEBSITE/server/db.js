require('dotenv').config();

const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);

let db;

async function connectDB() {
    await client.connect();
    console.log('MongoDB connected successfully');

    db = client.db('nss_srgc');

    return db;
}

function getDB() {
    return db;
}

module.exports = {
    connectDB,
    getDB
};