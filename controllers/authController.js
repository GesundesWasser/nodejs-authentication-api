const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../database/db");
const logger = require("../utils/logger");
const router = express.Router();

const SALT_ROUNDS = 12;
const JWT_SECRET = "1admin1";

function capitalizeFirstLetter(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Signup
router.post("/signup", async (req, res) => {
    let { username, email, password, role } = req.body;

    if (!username || !email || !password) {
        logger.warn("Signup attempt with missing fields", { username, email, hasPassword: !!password });
        return res.status(400).json({ error: "Username, email and password required" });
    }

    username = capitalizeFirstLetter(username);
    logger.info("Signup attempt", { username, email, role: role || "user" });

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    db.run(
        `INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)`,
        [username, email, hashedPassword, role || "user"],
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE")) {
                    logger.warn("Signup failed: username already exists", { username });
                    return res.status(409).json({ error: "Username exists" });
                }
                logger.error("Signup DB error", { username, error: err.message });
                return res.status(500).json({ error: "Database error" });
            }
            logger.info("Signup successful", { username, email, role: role || "user" });
            res.json({ message: "Signup successful", username });
        }
    );
});

// Login
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        logger.warn("Login attempt with missing credentials", { username });
        return res.status(400).json({ error: "Username and password required" });
    }

    logger.info("Login attempt", { username });

    db.get(`SELECT * FROM users WHERE username=?`, [username], async (err, user) => {
        if (err) {
            logger.error("Login DB error", { username, error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        if (!user) {
            logger.warn("Login failed: user not found", { username });
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            logger.warn("Login failed: wrong password", { username });
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
        logger.info("Login successful", { username, role: user.role });
        res.json({ token });
    });
});

// Profile (protected)
const { auth } = require("../middleware/auth");
router.get("/profile", auth, (req, res) => {
    logger.info("Profile fetch", { username: req.user.username });

    db.get(`SELECT username,email,role FROM users WHERE username=?`, [req.user.username], (err, user) => {
        if (err) {
            logger.error("Profile DB error", { username: req.user.username, error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        logger.debug("Profile returned", { username: req.user.username });
        res.json(user);
    });
});

module.exports = router;
