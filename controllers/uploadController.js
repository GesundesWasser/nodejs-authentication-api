const express = require("express");
const fs = require("fs");
const path = require("path");
const upload = require("../config/multer");
const { auth, adminOnly } = require("../middleware/auth");
const { toPNG } = require("../utils/sharpConvert");
const { videoToMP4, audioToMP3 } = require("../utils/ffmpegConvert");
const { hashBuffer, uploadToS3 } = require("../config/s3");

const router = express.Router();

router.post("/", auth, adminOnly, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const tmpPath = req.file.path;

    try {
        const mime = req.file.mimetype;
        let ext, contentType, buffer;

        if (mime.startsWith("image/")) {
            buffer = await toPNG(tmpPath);
            ext = "png";
            contentType = "image/png";

        } else if (mime.startsWith("video/")) {
            const mp4Path = await videoToMP4(tmpPath);
            buffer = await fs.promises.readFile(mp4Path);
            ext = "mp4";
            contentType = "video/mp4";
            fs.unlink(mp4Path, () => {});

        } else if (mime.startsWith("audio/")) {
            const mp3Path = await audioToMP3(tmpPath);
            buffer = await fs.promises.readFile(mp3Path);
            ext = "mp3";
            contentType = "audio/mpeg";
            fs.unlink(mp3Path, () => {});

        } else {
            return res.status(400).json({ error: "Unsupported file type" });
        }

        const hash = hashBuffer(buffer);
        const tmpFile = tmpPath + "." + ext;
        await fs.promises.writeFile(tmpFile, buffer);
        const s3Key = `uploads/${hash}.${ext}`;
        const url = await uploadToS3(tmpFile, s3Key, contentType);
        fs.unlink(tmpFile, () => {});
        res.json({ url });

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: "Processing or upload failed: " + err.message });
    } finally {
        fs.unlink(tmpPath, () => {});
    }
});

module.exports = router;