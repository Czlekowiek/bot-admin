const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGO_URI;
let db = null;

async function connectDB() {
    if (uri) {
        const mongoClient = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });

        try {
            await mongoClient.connect();
            db = mongoClient.db('bot_database');
            console.log('Połączono pomyślnie z bazą danych MongoDB!');
        } catch (err) {
            console.error('Błąd podczas łączenia z MongoDB:', err);
        }
    } else {
        console.warn('Brak zmiennej środowiskowej MONGO_URI! Baza danych nie została zainicjalizowana.');
    }
}

function getDb() {
    return db;
}

module.exports = { connectDB, getDb };