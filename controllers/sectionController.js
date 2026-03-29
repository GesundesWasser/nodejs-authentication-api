const express = require("express");
const db = require("../database/db");
const { auth, adminOnly } = require("../middleware/auth");
const logger = require("../utils/logger");
const router = express.Router();

// Get all sections
router.get("/", (req, res) => {
    logger.info("Fetching all sections");
    db.all(`SELECT * FROM sections ORDER BY id DESC`, (err, rows) => {
        if (err) {
            logger.error("Failed to fetch sections", { error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        const sections = rows.map(row => ({
            ...row,
            showButton: Boolean(row.showButton),
            disabled: Boolean(row.disabled)
        }));
        logger.debug("Sections fetched", { count: sections.length });
        res.json(sections);
    });
});

// Create section (admin)
router.post("/", auth, adminOnly, (req, res) => {
    const s = req.body;
    const author = req.user.username;
    const date = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

    logger.info("Creating section", { author, title: s.title });

    db.run(`
        INSERT INTO sections (
            imgSrc,imgAlt,author,date,title,description,
            videoSrc,videoType,showButton,buttonText,buttonLink,disabled
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
        s.imgSrc, s.imgAlt, author, date,
        s.title, s.description,
        s.videoSrc, s.videoType,
        s.showButton ? 1 : 0, s.buttonText, s.buttonLink,
        s.disabled ? 1 : 0
    ], function (err) {
        if (err) {
            logger.error("Failed to create section", { author, title: s.title, error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        logger.info("Section created", { id: this.lastID, author, title: s.title });
        res.json({ message: "Section created", id: this.lastID, author, date });
    });
});

// Update section
router.put("/:id", auth, adminOnly, (req, res) => {
    const s = req.body;
    const id = req.params.id;
    const date = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

    logger.info("Updating section", { id, updatedBy: req.user.username, title: s.title });

    db.run(`
        UPDATE sections SET
        imgSrc=?, imgAlt=?, author=?, date=?,
        title=?, description=?, videoSrc=?, videoType=?,
        showButton=?, buttonText=?, buttonLink=?, disabled=?
        WHERE id=?
    `, [
        s.imgSrc, s.imgAlt, req.user.username, date,
        s.title, s.description,
        s.videoSrc, s.videoType,
        s.showButton ? 1 : 0, s.buttonText, s.buttonLink,
        s.disabled ? 1 : 0, id
    ], function (err) {
        if (err) {
            logger.error("Failed to update section", { id, error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        logger.info("Section updated", { id, updatedBy: req.user.username });
        res.json({ message: "Section updated" });
    });
});

// Delete section
router.delete("/:id", auth, adminOnly, (req, res) => {
    const id = req.params.id;
    logger.info("Deleting section", { id, deletedBy: req.user.username });

    db.run(`DELETE FROM sections WHERE id=?`, [id], function (err) {
        if (err) {
            logger.error("Failed to delete section", { id, error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        logger.info("Section deleted", { id, deletedBy: req.user.username });
        res.json({ message: "Section deleted" });
    });
});

module.exports = router;
