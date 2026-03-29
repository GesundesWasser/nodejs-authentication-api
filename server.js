"use strict";
require('dotenv').config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./controllers/authController");
const uploadRoutes = require("./controllers/uploadController");
const sectionRoutes = require("./controllers/sectionController");
const shortlinkRoutes = require("./controllers/shortlinkController");

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/shorten", shortlinkRoutes);
app.get('/', (req, res) => {
    console.log("Anfrage von IP " + req.ip + " auf /")
    res.json({ message: 'Trying to hack KRDB or just checking for some bugs?' });
});

const port = 3000;
app.listen(port, () => console.log("Der Server läuft auf Port " + port + "!"));