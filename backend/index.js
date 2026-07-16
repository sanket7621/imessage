import express from "express";
import  cors from "cors";
import "dotenv/config";

import fs from "fs";
import path from "path";

import { clerkMiddleware } from "@clerk/express";

import user from "./src/models/user.model.js";
import { connectDB } from "./src/libs/db.js";

const app = express();
const PORT = process.env.PORT || 3001;
const frontendurl = process.env.FRONTEND_URL || process.env.CLIENT_URL || true;
const publicDir = path.resolve(process.cwd(), "public");

app.use(express.json());
app.use(cors({ origin: frontendurl, credentials: true }));
app.use(clerkMiddleware());

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  connectDB();
  console.log("server is up and running on port: ", PORT);
});

