const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    forcePathStyle: true
});

const S3_BUCKET = process.env.S3_BUCKET;
const S3_BASE_URL = process.env.S3_BASE_URL
    ? process.env.S3_BASE_URL.replace(/\/$/, "")
    : `${process.env.S3_ENDPOINT}`;

function hashBuffer(buf) {
    return crypto.createHash("sha256").update(buf).digest("hex");
}

async function uploadToS3(filePath, key, contentType) {
    const fileStream = fs.createReadStream(filePath);

    const upload = new Upload({
        client: s3,
        params: { Bucket: S3_BUCKET, Key: key, Body: fileStream, ContentType: contentType },
        queueSize: 4,
        partSize: 5 * 1024 * 1024
    });

    await upload.done();
    return `${S3_BASE_URL}/${key}`;
}

module.exports = { s3, S3_BUCKET, S3_BASE_URL, hashBuffer, uploadToS3 };