"use strict";
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");

const authRoutes = require("./controllers/authController");
const uploadRoutes = require("./controllers/uploadController");
const sectionRoutes = require("./controllers/sectionController");
const shortlinkRoutes = require("./controllers/shortlinkController");

const app = express();
app.use(express.json());
app.use(cors());

// HTTP request logger middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
        logger[level](`${req.method} ${req.originalUrl}`, {
            status: res.statusCode,
            ip: req.ip,
            duration: `${duration}ms`,
            userAgent: req.headers["user-agent"]
        });
    });
    next();
});

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/shorten", shortlinkRoutes);

app.get("/", (req, res) => {
    logger.info("Root endpoint accessed", { ip: req.ip });
    res.json({ message: "Trying to hack KRDB or just checking for some bugs?" });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error("Unhandled error", { error: err.message, stack: err.stack, url: req.originalUrl });
    res.status(500).json({ error: "Internal server error" });
});

const port = 3000;
app.listen(port, () => logger.info(`Server started`, { port }));
