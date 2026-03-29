const express = require("express");
const fetch = require("node-fetch");
const db = require("../database/db");
const { auth, adminOnly } = require("../middleware/auth");
const router = express.Router();

router.post("/", auth, adminOnly, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing URL" });

    db.get(`SELECT shortUrl FROM shortlinks WHERE longUrl=?`, [url], async (err, row) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (row) return res.json({ url: row.shortUrl, cached: true });

        try {
            const response = await fetch("https://api.tinysrc.me/v1/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            if (!response.ok) return res.status(500).json({ error: data.error || "Shortening failed" });

            const shortUrl = data.url;
            db.run(`INSERT INTO shortlinks (longUrl, shortUrl) VALUES (?,?)`, [url, shortUrl], function(err){
                if(err){
                    if(err.message.includes("UNIQUE")){
                        return db.get(`SELECT shortUrl FROM shortlinks WHERE longUrl=?`, [url], (err2,row2) => {
                            if(err2) return res.status(500).json({ error:"Database error" });
                            return res.json({ url: row2.shortUrl, cached:true });
                        });
                    }
                    return res.status(500).json({ error:"Database error" });
                }
                res.json({ url: shortUrl, cached: false });
            });

        } catch (err) {
            res.status(500).json({ error: "TinySRC error: " + err.message });
        }
    });
});

module.exports = router;