const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const JWT_SECRET = "1admin1";

function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
        logger.warn("Auth failed: missing token", { ip: req.ip, url: req.originalUrl });
        return res.status(401).json({ error: "Missing token" });
    }

    const token = header.split(" ")[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        logger.debug("Auth passed", { username: req.user.username, role: req.user.role, url: req.originalUrl });
        next();
    } catch (err) {
        logger.warn("Auth failed: invalid or expired token", { ip: req.ip, url: req.originalUrl, error: err.message });
        res.status(401).json({ error: "Invalid or expired token" });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        logger.warn("Admin check failed: insufficient role", {
            username: req.user.username,
            role: req.user.role,
            url: req.originalUrl
        });
        return res.status(403).json({ error: "Admin access required" });
    }
    logger.debug("Admin check passed", { username: req.user.username, url: req.originalUrl });
    next();
}

module.exports = { auth, adminOnly };
