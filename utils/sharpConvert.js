const sharp = require("sharp");

function toPNG(inputPath) {
    return sharp(inputPath).png().toBuffer();
}

module.exports = { toPNG };