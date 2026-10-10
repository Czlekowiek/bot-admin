const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGO_URI;
let clientInstance = null;
let db = null;

async function connectDB() {
    if (!uri) {
        console.warn('Brak zmiennej środowiskowej MONGO_URI!');
        return null;
    }
    if (db) return db;

    clientInstance = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });

    try {
        await clientInstance.connect();
        db = clientInstance.db('bot_database');
        console.log('Połączono pomyślnie z bazą danych MongoDB!');
        return db;
    } catch (err) {
        console.error('Błąd podczas łączenia z MongoDB:', err);
        throw err;
    }
}

function getDb() {
    return db;
}

module.exports = { connectDB, getDb };