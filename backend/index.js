import express from "express";
import  cors from "cors";
import "dotenv/config";

import fs from "fs";
import path from "path";

import { clerkMiddleware } from "@clerk/express";

import user from "./src/models/user.model.js";
import { connectDB } from "./src/libs/db.js";
import job from "./src/libs/cron.js";
import clerkWebhook from "./src/webhooks/clerk.webhook.js";

const app = express();
const PORT = process.env.PORT || 3001;
const frontendurl = process.env.FRONTEND_URL || "http://localhost:5173";
const publicDir = path.join(process.cwd(), "public");

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

app.listen( PORT , () => {

  connectDB();
  console.log("server is up and running on port: ", PORT)}  );

if (process.env.NODE_ENV === "production") {
  job.start();
}
  

