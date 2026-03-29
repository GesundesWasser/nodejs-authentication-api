"use strict";

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

require('dotenv').config();
const app = express();
app.use(express.json());
app.use(cors()); // enable CORS for all origins

const port = 3000;
const SALT_ROUNDS = 12;
const JWT_SECRET = "1admin1";
const API_KEY = "1krdb1";
let currentStats = {
    playerCount: 0,
    players: []
};
/* =========================
   S3 Config
   Set these env vars:
     AWS_REGION
     AWS_ACCESS_KEY_ID
     AWS_SECRET_ACCESS_KEY
     S3_BUCKET
     S3_BASE_URL  (optional, e.g. https://cdn.example.com)
========================= */
const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    forcePathStyle: true
});
const S3_BUCKET = process.env.S3_BUCKET;
const S3_BASE_URL = process.env.S3_BASE_URL
    ? process.env.S3_BASE_URL.replace(/\/$/, "")
    : `${process.env.S3_ENDPOINT}`;

/* =========================
   Multer — store to tmp
========================= */
const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();

    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".mov"];

    const ok = allowed.includes(ext);

    cb(ok ? null : new Error("Only image and video files are allowed"), ok);
}
});

/* =========================
   Helpers
========================= */

/** SHA-256 hash of a Buffer, returned as hex */
function hashBuffer(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

async function uploadToS3(filePath, key, contentType) {
    const fileStream = fs.createReadStream(filePath);

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: S3_BUCKET,
            Key: key,
            Body: fileStream,
            ContentType: contentType
        },
        queueSize: 4, // concurrency for multipart
        partSize: 5 * 1024 * 1024 // 5 MB per part
    });

    await upload.done();
    return `${S3_BASE_URL}/${key}`;
}


/** Convert any image to PNG using sharp */
async function toPNG(inputPath) {
    return sharp(inputPath).png().toBuffer();
}

/** Convert any video to MP4 using ffmpeg, returns a Buffer */
function toMP4(inputPath) {
    return new Promise((resolve, reject) => {
        const outPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp4`);
        ffmpeg(inputPath)
            .outputOptions([
                "-c:v libx264",
                "-preset fast",
                "-crf 22",
                "-c:a aac",
                "-movflags +faststart"
            ])
            .output(outPath)
            .on("end", () => {
                const buf = fs.readFileSync(outPath);
                fs.unlink(outPath, () => {});
                resolve(buf);
            })
            .on("error", reject)
            .run();
    });
}

/* =========================
   Database
========================= */
const db = new sqlite3.Database("./database.db");

db.serialize(() => {
    
    // Accounts
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )`);
    
    // Short Links für Sign Picture
    db.run(`
    CREATE TABLE IF NOT EXISTS shortlinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    longUrl TEXT UNIQUE,
    shortUrl TEXT
    )`);

    // Website Daten
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
    KRDB Mod
========================= */
app.post("/api/stats", (req, res) => {
    const key = req.headers["x-api-key"];
    if (key !== API_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    console.log("REQUEST FROM MOD: " + req);

    const { playerCount, players } = req.body;

    if (typeof playerCount === "number") {
        currentStats.playerCount = playerCount;
    }

    if (Array.isArray(players) && players.every(p => typeof p === "string")) {
        currentStats.players = players;
        currentStats.playerCount = players.length;
    }

    res.json({ success: true, currentStats });
});

app.get("/api/stats", (req, res) => {
    res.json(currentStats);
});
    /* =========================
   Upload — image → PNG, video → MP4
   POST /api/upload
   Auth: Bearer token (admin)
   Body: multipart/form-data, field name "file"
   Returns: { url: "https://..." }
========================= */

app.post("/api/upload", auth, adminOnly, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const tmpPath = req.file.path;

    try {
        const mime = req.file.mimetype;
        let ext, contentType;

        if (mime.startsWith("image/")) {
            // Convert to PNG
            const buffer = await toPNG(tmpPath);
            ext = "png";
            contentType = "image/png";

            // Save buffer to temp file for streaming
            const tmpPng = tmpPath + ".png";
            await fs.promises.writeFile(tmpPng, buffer);
            const hash = hashBuffer(buffer);
            const s3Key = `uploads/${hash}.${ext}`;

            const url = await uploadToS3(tmpPng, s3Key, contentType);
            fs.unlink(tmpPng, () => {});
            res.json({ url });

        } else if (mime.startsWith("video/")) {
            // Convert to MP4
            const mp4Path = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp4`);
            await new Promise((resolve, reject) => {
                ffmpeg(tmpPath)
                    .outputOptions([
                        "-c:v libx264",
                        "-preset fast",
                        "-crf 22",
                        "-c:a aac",
                        "-movflags +faststart"
                    ])
                    .output(mp4Path)
                    .on("end", resolve)
                    .on("error", reject)
                    .run();
            });

            // Hash from file buffer
            const buffer = await fs.promises.readFile(mp4Path);
            const hash = hashBuffer(buffer);
            ext = "mp4";
            contentType = "video/mp4";
            const s3Key = `uploads/${hash}.${ext}`;

            const url = await uploadToS3(mp4Path, s3Key, contentType);
            fs.unlink(mp4Path, () => {});
            res.json({ url });

        } else {
            return res.status(400).json({ error: "Unsupported file type" });
        }

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Processing or upload failed: " + err.message });
    } finally {
        fs.unlink(tmpPath, () => {});
    }
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
   Shorten URL (cached, admin only)
   POST /api/shorten
   Body: { url: "https://..." }
========================= */

app.post("/api/shorten", auth, adminOnly, async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "Missing URL" });
    }

    try {
        // ✅ 1. Check database cache first
        db.get(`SELECT shortUrl FROM shortlinks WHERE longUrl=?`, [url], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: "Database error" });
            }

            if (row) {
                // ✅ Already exists
                return res.json({
                    url: row.shortUrl,
                    cached: true
                });
            }

            try {
                // ✅ 2. Call TinySRC API
                const response = await fetch("https://api.tinysrc.me/v1/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ url })
                });

                const data = await response.json();

                if (!response.ok) {
                    return res.status(500).json({
                        error: data.error || "Shortening failed"
                    });
                }

                const shortUrl = data.url;

                // ✅ 3. Save to database
                db.run(
                    `INSERT INTO shortlinks (longUrl, shortUrl) VALUES (?, ?)`,
                    [url, shortUrl],
                    function (err) {
                        if (err) {
                            // Edge case: race condition (duplicate insert)
                            if (err.message.includes("UNIQUE")) {
                                return db.get(
                                    `SELECT shortUrl FROM shortlinks WHERE longUrl=?`,
                                    [url],
                                    (err2, row2) => {
                                        if (err2) {
                                            return res.status(500).json({ error: "Database error" });
                                        }
                                        return res.json({
                                            url: row2.shortUrl,
                                            cached: true
                                        });
                                    }
                                );
                            }

                            return res.status(500).json({ error: "Database error" });
                        }

                        res.json({
                            url: shortUrl,
                            cached: false
                        });
                    }
                );

            } catch (err) {
                res.status(500).json({ error: "TinySRC error: " + err.message });
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/* =========================
   Start server
========================= */

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});