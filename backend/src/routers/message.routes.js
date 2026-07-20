import express from "express";
import {
  deleteMessage,
  getConversationsForSidebar,
  getMessages,
  getUsersForSidebar,
  sendMessage,
  updateMessage,
} from "../controllres/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/users", getUsersForSidebar);
router.get("/conversations", getConversationsForSidebar);
router.patch("/edit/:messageId", updateMessage);
router.delete("/remove/:messageId", deleteMessage);
router.get("/:id", getMessages);
router.post("/send/:id", upload.single("media"), sendMessage);

export default router;