import express from "express";
import cors from "cors";
import "dotenv/config";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { clerkMiddleware } from "@clerk/express";

import { connectDB } from "./src/libs/db.js";
import job from "./src/libs/cron.js";
import clerkWebhook from "./src/webhooks/clerk.webhook.js";

const app = express();
const PORT = process.env.PORT || 3001;
const frontendurl = process.env.FRONTEND_URL || "http://localhost:5173";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In production, public is at ../public (sibling of dist), locally it's also ../public
const publicDir = path.join(__dirname, "..", "public");

app.use("/api/webhooks/clerk", express.raw({ type: "application/json" }), clerkWebhook);

app.use(express.json());
app.use(cors({origin:frontendurl, credentials: true}));
app.use(clerkMiddleware());

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/*", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, async () => {
  await connectDB();
  console.log("server is up and running on port: ", PORT);
});

if (process.env.NODE_ENV === "production") {
  job.start();
}
  

