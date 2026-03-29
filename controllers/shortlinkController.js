const express = require("express");
const fetch = require("node-fetch");
const db = require("../database/db");
const { auth, adminOnly } = require("../middleware/auth");
const logger = require("../utils/logger");
const router = express.Router();

router.post("/", auth, adminOnly, async (req, res) => {
    const { url } = req.body;

    if (!url) {
        logger.warn("Shortlink request missing URL", { user: req.user.username });
        return res.status(400).json({ error: "Missing URL" });
    }

    logger.info("Shortlink requested", { url, user: req.user.username });

    db.get(`SELECT shortUrl FROM shortlinks WHERE longUrl=?`, [url], async (err, row) => {
        if (err) {
            logger.error("Shortlink DB lookup error", { url, error: err.message });
            return res.status(500).json({ error: "Database error" });
        }
        if (row) {
            logger.info("Shortlink cache hit", { url, shortUrl: row.shortUrl });
            return res.json({ url: row.shortUrl, cached: true });
        }

        logger.debug("No cache hit, calling TinySRC", { url });

        try {
            const response = await fetch("https://api.tinysrc.me/v1/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });

            const data = await response.json();
            if (!response.ok) {
                logger.error("TinySRC API error", { url, status: response.status, error: data.error });
                return res.status(500).json({ error: data.error || "Shortening failed" });
            }

            const shortUrl = data.url;
            logger.debug("TinySRC returned shortlink", { url, shortUrl });

            db.run(`INSERT INTO shortlinks (longUrl, shortUrl) VALUES (?,?)`, [url, shortUrl], function (err) {
                if (err) {
                    if (err.message.includes("UNIQUE")) {
                        logger.warn("Shortlink race condition, fetching existing", { url });
                        return db.get(`SELECT shortUrl FROM shortlinks WHERE longUrl=?`, [url], (err2, row2) => {
                            if (err2) {
                                logger.error("Shortlink fallback DB error", { url, error: err2.message });
                                return res.status(500).json({ error: "Database error" });
                            }
                            return res.json({ url: row2.shortUrl, cached: true });
                        });
                    }
                    logger.error("Shortlink insert DB error", { url, error: err.message });
                    return res.status(500).json({ error: "Database error" });
                }
                logger.info("Shortlink created and stored", { url, shortUrl });
                res.json({ url: shortUrl, cached: false });
            });

        } catch (err) {
            logger.error("TinySRC fetch error", { url, error: err.message });
            res.status(500).json({ error: "TinySRC error: " + err.message });
        }
    });
});

module.exports = router;
