const sharp = require("sharp");
const logger = require("./logger");

function toPNG(inputPath) {
  logger.debug("Converting image to PNG with sharp", { inputPath });
  return sharp(inputPath)
    .png()
    .toBuffer()
    .then((buf) => {
      logger.debug("sharp PNG conversion complete", {
        inputPath,
        outputBytes: buf.length,
      });
      return buf;
    })
    .catch((err) => {
      logger.error("sharp PNG conversion failed", {
        inputPath,
        error: err.message,
      });
      throw err;
    });
}

module.exports = { toPNG };
