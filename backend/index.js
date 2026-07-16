import express from "express";
import  cors from "cors";
import "dotenv/config";
import { clerkMiddleware } from "@clerk/express";

import user from "./src/models/user.model.js";
import { connectDB } from "./src/libs/db.js";

const app = express();
const PORT = process.env.PORT 
const frontendurl = process.env.FRONTEND_URL

app.use(express.json());
app.use(cors({origin:frontendurl, credentials: true}));
app.use(clerkMiddleware());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen( PORT , () => {

  connectDB();
  console.log("server is up and running on port: ", PORT)}  );

