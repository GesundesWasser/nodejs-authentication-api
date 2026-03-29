const sqlite3 = require("sqlite3").verbose();
const logger = require("../utils/logger");

logger.info("Initializing SQLite database", { path: "./database.db" });
const db = new sqlite3.Database("./database.db", (err) => {
    if (err) logger.error("Failed to open database", { error: err.message });
    else logger.info("Database connection established");
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `, (err) => {
        if (err) logger.error("Failed to create users table", { error: err.message });
        else logger.debug("users table ready");
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS shortlinks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            longUrl TEXT UNIQUE,
            shortUrl TEXT
        )
    `, (err) => {
        if (err) logger.error("Failed to create shortlinks table", { error: err.message });
        else logger.debug("shortlinks table ready");
    });

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
    `, (err) => {
        if (err) logger.error("Failed to create sections table", { error: err.message });
        else logger.debug("sections table ready");
    });
});

module.exports = db;
