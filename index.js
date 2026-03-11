"use strict";

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // enable CORS for all origins

const port = 3000;
const SALT_ROUNDS = 12;
const JWT_SECRET = "1admin1";

/* =========================
   Database
========================= */

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
    // Users table with role
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )`);

    // Sections table with all jSec fields
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
    )`);
});

/* =========================
   Auth Middleware
========================= */

function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });

    const token = header.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
}

/* =========================
   Signup
========================= */

function capitalizeFirstLetter(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

app.post("/signup", async (req, res) => {
    let { username, email, password, role } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email and password required" });
    }

    username = capitalizeFirstLetter(username); // <-- capitalize

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    db.run(
        `INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)`,
        [username, email, hashedPassword, role || "user"],
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Username exists" });
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ message: "Signup successful", username });
        }
    );
});

/* =========================
   Login
========================= */

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    db.get(`SELECT * FROM users WHERE username=?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign(
            { username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ token });
    });
});

/* =========================
   Profile (protected)
========================= */

app.get("/profile", auth, (req, res) => {
    db.get(`SELECT username,email,role FROM users WHERE username=?`, [req.user.username], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(user);
    });
});

/* =========================
   Sections Routes
========================= */

// Get all sections (public)
app.get("/api/sections", (req, res) => {
    db.all(`SELECT * FROM sections ORDER BY id DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        const sections = rows.map(row => ({
            id: row.id,
            imgSrc: row.imgSrc,
            imgAlt: row.imgAlt,
            author: row.author,
            date: row.date,
            title: row.title,
            description: row.description,
            videoSrc: row.videoSrc,
            videoType: row.videoType,
            showButton: Boolean(row.showButton),
            buttonText: row.buttonText,
            buttonLink: row.buttonLink,
            disabled: Boolean(row.disabled)
        }));
        res.json(sections);
    });
});

// Create section (admin only)
app.post("/api/sections", auth, adminOnly, (req, res) => {
    const s = req.body;
    const author = req.user.username;

    // Current date in Vienna
    const date = new Intl.DateTimeFormat("de-AT", {
        timeZone: "Europe/Vienna",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(new Date());

    db.run(`
        INSERT INTO sections (
            imgSrc,imgAlt,author,date,
            title,description,
            videoSrc,videoType,
            showButton,buttonText,buttonLink,
            disabled
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
        s.imgSrc, s.imgAlt, author, date,
        s.title, s.description,
        s.videoSrc, s.videoType,
        s.showButton ? 1 : 0, s.buttonText, s.buttonLink,
        s.disabled ? 1 : 0
    ], function(err){
        if(err) return res.status(500).json({error:"Database error"});
        res.json({ message:"Section created", id:this.lastID, author, date });
    });
});

// Update section (admin only)
app.put("/api/sections/:id", auth, adminOnly, (req,res)=>{
    const id = req.params.id;
    const s = req.body;

    db.run(`
        UPDATE sections SET
        imgSrc=?,
        imgAlt=?,
        author=?,
        date=?,
        title=?,
        description=?,
        videoSrc=?,
        videoType=?,
        showButton=?,
        buttonText=?,
        buttonLink=?,
        disabled=?
        WHERE id=?
    `, [
        s.imgSrc, s.imgAlt, req.user.username, // author = logged-in admin
        new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()),
        s.title, s.description,
        s.videoSrc, s.videoType,
        s.showButton ? 1 : 0,
        s.buttonText, s.buttonLink,
        s.disabled ? 1 : 0,
        id
    ], function(err){
        if(err) return res.status(500).json({error:"Database error"});
        res.json({ message:"Section updated" });
    });
});

// Delete section (admin only)
app.delete("/api/sections/:id", auth, adminOnly, (req,res)=>{
    db.run(`DELETE FROM sections WHERE id=?`, [req.params.id], function(err){
        if(err) return res.status(500).json({error:"Database error"});
        res.json({ message:"Section deleted" });
    });
});

/* =========================
   Start server
========================= */

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});