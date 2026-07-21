import { Server } from "socket.io";

import User from "../models/user.model.js";

/** @type {Map<string, number>} userId -> active socket count (supports multiple tabs) */
const connectedUsers = new Map();

const noopIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
  on: () => {},
};

export let io = noopIo;

function getOnlineUserIds() {
  return Array.from(connectedUsers.keys());
}

function markUserOnline(userId) {
  const id = String(userId);
  const nextCount = (connectedUsers.get(id) ?? 0) + 1;
  connectedUsers.set(id, nextCount);
  return nextCount === 1;
}

function markUserOffline(userId) {
  const id = String(userId);
  const nextCount = (connectedUsers.get(id) ?? 0) - 1;
  if (nextCount <= 0) {
    connectedUsers.delete(id);
    return true;
  }
  connectedUsers.set(id, nextCount);
  return false;
}

export function initializeSocket(server) {
  const socketServer = new Server(server, {
    cors: {
      origin: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),
      credentials: true,
    },
  });

  socketServer.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (!userId) return;

    const uid = String(userId);
    socket.join(`user:${uid}`);

    const becameOnline = markUserOnline(uid);

    // Full list only for the connecting client — avoids rebroadcasting to everyone.
    socket.emit("getOnlineUsers", getOnlineUserIds());

    if (becameOnline) {
      socket.broadcast.emit("userOnline", uid);
    }

    socket.on("typing", ({ receiverId }) => {
      if (!receiverId) return;
      socket.to(`user:${String(receiverId)}`).emit("userTyping", { userId: uid });
    });

    socket.on("stopTyping", ({ receiverId }) => {
      if (!receiverId) return;
      socket.to(`user:${String(receiverId)}`).emit("userStoppedTyping", { userId: uid });
    });

    socket.on("disconnect", () => {
      const becameOffline = markUserOffline(uid);
      if (becameOffline) {
        const lastSeenAt = new Date();
        User.findByIdAndUpdate(uid, { lastSeenAt }).catch((error) => {
          console.error("[socket] failed to update lastSeenAt:", error?.message ?? error);
        });
        socket.broadcast.emit("userLastSeen", { userId: uid, lastSeenAt: lastSeenAt.toISOString() });
        socket.broadcast.emit("userOffline", uid);
      }
    });
  });

  io = socketServer;
  return io;
}

export function isUserOnline(userId) {
  return connectedUsers.has(String(userId));
}

export function getReceiverSocketId(receiverId) {
  if (!isUserOnline(receiverId)) return null;
  const sockets = io.sockets?.adapter?.rooms?.get(`user:${String(receiverId)}`);
  if (!sockets?.size) return null;
  return sockets.values().next().value ?? null;
}
