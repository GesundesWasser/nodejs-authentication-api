const express = require("express");
const router = express.Router();

const API_KEY = "1krdb1";

// In-memory stats (same as before)
let currentStats = {
    playerCount: 0,
    players: []
};

// POST /api/stats (from mod)
router.post("/", (req, res) => {
    const key = req.headers["x-api-key"];
    if (key !== API_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
    }

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

// GET /api/stats (public)
router.get("/", (req, res) => {
    res.json(currentStats);
});

module.exports = router;