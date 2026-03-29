const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../database/db");
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
    if (!username || !email || !password) return res.status(400).json({ error: "Username, email and password required" });
    username = capitalizeFirstLetter(username);
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

// Login
router.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    db.get(`SELECT * FROM users WHERE username=?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    });
});

// Profile (protected)
const { auth } = require("../middleware/auth");
router.get("/profile", auth, (req, res) => {
    db.get(`SELECT username,email,role FROM users WHERE username=?`, [req.user.username], (err, user) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(user);
    });
});

module.exports = router;