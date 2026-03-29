const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

// Convert video to MP4
function videoToMP4(inputPath) {
    return new Promise((resolve, reject) => {
        const outPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp4`);
        ffmpeg(inputPath)
            .outputOptions(["-c:v libx264", "-preset fast", "-crf 22", "-c:a aac", "-movflags +faststart"])
            .output(outPath)
            .on("end", () => resolve(outPath))
            .on("error", reject)
            .run();
    });
}

// Convert audio to MP3
function audioToMP3(inputPath) {
    return new Promise((resolve, reject) => {
        const outPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp3`);
        ffmpeg(inputPath)
            .outputOptions(["-codec:a libmp3lame", "-qscale:a 2"])
            .output(outPath)
            .on("end", () => resolve(outPath))
            .on("error", reject)
            .run();
    });
}

module.exports = { videoToMP4, audioToMP3 };