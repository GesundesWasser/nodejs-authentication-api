const jwt = require("jsonwebtoken");
const JWT_SECRET = "1admin1";

function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "Missing token" });

    const token = header.split(" ")[1];
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    next();
}

module.exports = { auth, adminOnly };