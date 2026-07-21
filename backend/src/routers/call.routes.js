import express from "express";

import { getIceServers } from "../controllres/call.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);
router.get("/ice-servers", getIceServers);

export default router;
