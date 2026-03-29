const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS shortlinks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            longUrl TEXT UNIQUE,
            shortUrl TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imgSrc TEXT,
            imgAlt TEXT,
            author TEXT,
            date TEXT,
            title TEXT,
            description TEXT,
            videoSrc TEXT,
            videoType TEXT,
            showButton INTEGER,
            buttonText TEXT,
            buttonLink TEXT,
            disabled INTEGER
        )
    `);
});

module.exports = db;