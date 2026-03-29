const express = require("express");
const fs = require("fs");
const path = require("path");
const upload = require("../config/multer");
const { auth, adminOnly } = require("../middleware/auth");
const { toPNG } = require("../utils/sharpConvert");
const { videoToMP4, audioToMP3 } = require("../utils/ffmpegConvert");
const { hashBuffer, uploadToS3 } = require("../config/s3");
const logger = require("../utils/logger");

const router = express.Router();

router.post("/", auth, adminOnly, upload.single("file"), async (req, res) => {
    if (!req.file) {
        logger.warn("Upload attempt with no file", { user: req.user.username });
        return res.status(400).json({ error: "No file uploaded" });
    }

    const tmpPath = req.file.path;
    const mime = req.file.mimetype;
    const originalName = req.file.originalname;
    const sizeKB = (req.file.size / 1024).toFixed(1);

    logger.info("File upload started", {
        user: req.user.username,
        originalName,
        mime,
        sizeKB: `${sizeKB} KB`,
        tmpPath
    });

    try {
        let ext, contentType, buffer;

        if (mime === "image/svg+xml") {
            logger.debug("Reading SVG as-is", { originalName });
            buffer = await fs.promises.readFile(tmpPath);
            ext = "svg";
            contentType = "image/svg+xml";
            logger.debug("SVG read complete", { originalName, outputSizeKB: (buffer.length / 1024).toFixed(1) });

        } else if (mime.startsWith("image/")) {
            logger.debug("Converting image to PNG", { originalName });
            buffer = await toPNG(tmpPath);
            ext = "png";
            contentType = "image/png";
            logger.debug("Image conversion complete", { originalName, outputSizeKB: (buffer.length / 1024).toFixed(1) });

        } else if (mime.startsWith("video/")) {
            logger.debug("Converting video to MP4", { originalName });
            const mp4Path = await videoToMP4(tmpPath);
            buffer = await fs.promises.readFile(mp4Path);
            ext = "mp4";
            contentType = "video/mp4";
            logger.debug("Video conversion complete", { originalName, outputSizeKB: (buffer.length / 1024).toFixed(1) });
            fs.unlink(mp4Path, () => {});

        } else if (mime.startsWith("audio/")) {
            logger.debug("Converting audio to MP3", { originalName });
            const mp3Path = await audioToMP3(tmpPath);
            buffer = await fs.promises.readFile(mp3Path);
            ext = "mp3";
            contentType = "audio/mpeg";
            logger.debug("Audio conversion complete", { originalName, outputSizeKB: (buffer.length / 1024).toFixed(1) });
            fs.unlink(mp3Path, () => {});

        } else {
            logger.warn("Unsupported file type rejected", { originalName, mime, user: req.user.username });
            return res.status(400).json({ error: "Unsupported file type" });
        }

        const hash = hashBuffer(buffer);
        const tmpFile = tmpPath + "." + ext;
        const s3Key = `uploads/${hash}.${ext}`;

        logger.debug("Uploading to S3", { s3Key, contentType });
        await fs.promises.writeFile(tmpFile, buffer);
        const url = await uploadToS3(tmpFile, s3Key, contentType);
        fs.unlink(tmpFile, () => {});

        logger.info("File upload successful", {
            user: req.user.username,
            originalName,
            s3Key,
            url
        });

        res.json({ url });

    } catch (err) {
        logger.error("Upload processing failed", {
            user: req.user.username,
            originalName,
            mime,
            error: err.message,
            stack: err.stack
        });
        res.status(500).json({ error: "Processing or upload failed: " + err.message });
    } finally {
        fs.unlink(tmpPath, () => {});
    }
});

module.exports = router;
