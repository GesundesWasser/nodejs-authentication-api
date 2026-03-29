const express = require("express");
const db = require("../database/db");
const { auth, adminOnly } = require("../middleware/auth");
const router = express.Router();

// Get all sections
router.get("/", (req, res) => {
    db.all(`SELECT * FROM sections ORDER BY id DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        const sections = rows.map(row => ({
            ...row,
            showButton: Boolean(row.showButton),
            disabled: Boolean(row.disabled)
        }));
        res.json(sections);
    });
});

// Create section (admin)
router.post("/", auth, adminOnly, (req, res) => {
    const s = req.body;
    const author = req.user.username;
    const date = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day:"2-digit", month:"2-digit", year:"numeric" }).format(new Date());

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
    ], function(err) {
        if(err) return res.status(500).json({ error:"Database error" });
        res.json({ message:"Section created", id:this.lastID, author, date });
    });
});

// Update section
router.put("/:id", auth, adminOnly, (req, res) => {
    const s = req.body;
    const id = req.params.id;
    const date = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day:"2-digit", month:"2-digit", year:"numeric" }).format(new Date());

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
    ], function(err) {
        if(err) return res.status(500).json({ error:"Database error" });
        res.json({ message:"Section updated" });
    });
});

// Delete section
router.delete("/:id", auth, adminOnly, (req,res) => {
    db.run(`DELETE FROM sections WHERE id=?`, [req.params.id], function(err){
        if(err) return res.status(500).json({error:"Database error"});
        res.json({ message:"Section deleted" });
    });
});

module.exports = router;