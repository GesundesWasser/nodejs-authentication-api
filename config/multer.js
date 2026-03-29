const multer = require("multer");
const os = require("os");
const path = require("path");

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = [".png", ".jpg", ".jpeg", ".gif", ".mp4", ".webm", ".mov", ".mp3", ".wav", ".m4a", ".aac", ".flac"];
        cb(allowed.includes(ext) ? null : new Error("Unsupported file type"), allowed.includes(ext));
    }
});

module.exports = upload;