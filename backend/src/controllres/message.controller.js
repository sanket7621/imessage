import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { hasImageKitConfig, uploadChatMedia } from "../libs/imagekit.js";
import { io } from "../libs/socket.js";

function emitToParticipants(message, event, payload) {
  io.to(`user:${String(message.senderId)}`).emit(event, payload);
  io.to(`user:${String(message.receiverId)}`).emit(event, payload);
}

async function findAuthorizedMessage(messageId, userId) {
  const message = await Message.findById(messageId);
  if (!message) return { error: { status: 404, message: "Message not found" } };

  const isParticipant =
    String(message.senderId) === String(userId) ||
    String(message.receiverId) === String(userId);

  if (!isParticipant) {
    return { error: { status: 403, message: "Not allowed to access this message" } };
  }

  return { message };
}

export async function getUsersForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-clerkId");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getConversationsForSidebar(req, res) {
  try {
    const loggedInUserId = req.user._id;

    const conversations = await Message.aggregate([
      // 1. Keep only the messages I sent or received.
      { $match: { $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }] } },
      // 2. Collapse them into one row per chat partner, noting our latest message time.
      {
        $group: {
          // The partner is the other person on the message (not me).
          _id: { $cond: [{ $eq: ["$senderId", loggedInUserId] }, "$receiverId", "$senderId"] },
          lastMessageAt: { $max: "$createdAt" },
        },
      },
      // 3. Put the most recent conversation at the top.
      { $sort: { lastMessageAt: -1 } },
      // 4. Look up each partner's user profile (comes back as an array).
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      // 5. Pull that profile out of the array and make it the document.
      { $replaceRoot: { newRoot: { $first: "$user" } } },
      // 6. Hide the private clerkId field from the result.
      { $project: { clerkId: 0 } },
    ]);

    res.status(200).json(conversations);
  } catch (error) {
    console.error("Error in getConversationsForSidebar:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { text } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    let videoUrl;

    if (req.file) {
      if (!hasImageKitConfig()) {
        return res.status(500).json({ message: "Media upload is not configured" });
      }

      const url = await uploadChatMedia(req.file);
      if (req.file.mimetype.startsWith("video/")) videoUrl = url;
      else imageUrl = url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      video: videoUrl,
    });

    await newMessage.save();

    io.to(`user:${String(receiverId)}`).emit("newMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function updateMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const trimmedText = typeof text === "string" ? text.trim() : "";

    if (!trimmedText) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const { message, error } = await findAuthorizedMessage(messageId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (String(message.senderId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the sender can edit a message" });
    }

    if (message.image || message.video) {
      return res.status(400).json({ message: "Media messages cannot be edited" });
    }

    message.text = trimmedText;
    message.editedAt = new Date();
    await message.save();

    emitToParticipants(message, "messageUpdated", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in updateMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteMessage(req, res) {
  try {
    const { messageId } = req.params;

    const { message, error } = await findAuthorizedMessage(messageId, req.user._id);
    if (error) return res.status(error.status).json({ message: error.message });

    if (String(message.senderId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Only the sender can delete a message" });
    }

    await message.deleteOne();

    emitToParticipants(message, "messageDeleted", { _id: message._id });

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error in deleteMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
}

