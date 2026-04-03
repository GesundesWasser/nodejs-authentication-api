const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const logger = require("./logger");

// Convert video to MP4
function videoToMP4(inputPath) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp4`);
    logger.debug("Starting video to MP4 conversion", { inputPath, outPath });

    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 22",
        "-c:a aac",
        "-movflags +faststart",
      ])
      .output(outPath)
      .on("start", (cmd) =>
        logger.debug("ffmpeg video command started", { cmd }),
      )
      .on("progress", (p) =>
        logger.debug("ffmpeg video progress", {
          percent: p.percent?.toFixed(1),
        }),
      )
      .on("end", () => {
        logger.debug("Video to MP4 conversion complete", { outPath });
        resolve(outPath);
      })
      .on("error", (err) => {
        logger.error("Video to MP4 conversion failed", {
          inputPath,
          error: err.message,
        });
        reject(err);
      })
      .run();
  });
}

// Convert audio to MP3
function audioToMP3(inputPath) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.mp3`);
    logger.debug("Starting audio to MP3 conversion", { inputPath, outPath });

    ffmpeg(inputPath)
      .outputOptions(["-codec:a libmp3lame", "-qscale:a 2"])
      .output(outPath)
      .on("start", (cmd) =>
        logger.debug("ffmpeg audio command started", { cmd }),
      )
      .on("end", () => {
        logger.debug("Audio to MP3 conversion complete", { outPath });
        resolve(outPath);
      })
      .on("error", (err) => {
        logger.error("Audio to MP3 conversion failed", {
          inputPath,
          error: err.message,
        });
        reject(err);
      })
      .run();
  });
}

module.exports = { videoToMP4, audioToMP3 };
