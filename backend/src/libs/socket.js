import { Server } from "socket.io";

import {
  createCall,
  endCall,
  endCallForUser,
  getCall,
  getCallPeer,
  isCallParticipant,
  isUserInCall,
  markCallActive,
} from "./callState.js";
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

function emitToCall(callId, event, payload, excludeUserId = null) {
  const call = getCall(callId);
  if (!call) return;

  const participants = [call.callerId, call.calleeId];
  for (const participantId of participants) {
    if (excludeUserId && String(participantId) === String(excludeUserId)) continue;
    io.to(`user:${participantId}`).emit(event, payload);
  }
}

function terminateCall(callId, endedByUserId, reason = "ended") {
  const call = endCall(callId);
  if (!call) return;

  const payload = { callId: String(callId), endedBy: String(endedByUserId), reason };
  io.to(`user:${call.callerId}`).emit("call:ended", payload);
  io.to(`user:${call.calleeId}`).emit("call:ended", payload);
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

    socket.on("call:initiate", async ({ callId, calleeId }) => {
      if (!callId || !calleeId) {
        socket.emit("call:error", { callId, message: "Invalid call request" });
        return;
      }

      if (String(calleeId) === uid) {
        socket.emit("call:error", { callId, message: "Cannot call yourself" });
        return;
      }

      if (isUserInCall(uid) || isUserInCall(calleeId)) {
        socket.emit("call:error", { callId, message: "User is busy" });
        return;
      }

      if (!connectedUsers.has(String(calleeId))) {
        socket.emit("call:error", { callId, message: "User is offline" });
        return;
      }

      const caller = await User.findById(uid).select("fullName profilePic");
      if (!caller) {
        socket.emit("call:error", { callId, message: "Caller not found" });
        return;
      }

      createCall(callId, uid, calleeId);

      socket.emit("call:initiated", { callId: String(callId), calleeId: String(calleeId) });

      io.to(`user:${String(calleeId)}`).emit("call:incoming", {
        callId: String(callId),
        caller: {
          userId: uid,
          fullName: caller.fullName,
          profilePic: caller.profilePic,
        },
      });
    });

    socket.on("call:accept", ({ callId }) => {
      const call = getCall(callId);
      if (!call || call.calleeId !== uid || call.status !== "ringing") {
        socket.emit("call:error", { callId, message: "Call is no longer available" });
        return;
      }

      markCallActive(callId);
      emitToCall(callId, "call:accepted", { callId: String(callId) });
    });

    socket.on("call:reject", ({ callId }) => {
      const call = getCall(callId);
      if (!call || !isCallParticipant(call, uid)) return;
      terminateCall(callId, uid, "rejected");
    });

    socket.on("call:cancel", ({ callId }) => {
      const call = getCall(callId);
      if (!call || call.callerId !== uid || call.status !== "ringing") return;
      terminateCall(callId, uid, "cancelled");
    });

    socket.on("call:end", ({ callId }) => {
      const call = getCall(callId);
      if (!call || !isCallParticipant(call, uid)) return;
      terminateCall(callId, uid, "ended");
    });

    socket.on("webrtc:offer", ({ callId, sdp }) => {
      const call = getCall(callId);
      if (!call || !isCallParticipant(call, uid) || !sdp) return;

      const peerId = getCallPeer(call, uid);
      io.to(`user:${peerId}`).emit("webrtc:offer", { callId: String(callId), sdp, from: uid });
    });

    socket.on("webrtc:answer", ({ callId, sdp }) => {
      const call = getCall(callId);
      if (!call || !isCallParticipant(call, uid) || !sdp) return;

      const peerId = getCallPeer(call, uid);
      io.to(`user:${peerId}`).emit("webrtc:answer", { callId: String(callId), sdp, from: uid });
    });

    socket.on("webrtc:ice-candidate", ({ callId, candidate }) => {
      const call = getCall(callId);
      if (!call || !isCallParticipant(call, uid) || !candidate) return;

      const peerId = getCallPeer(call, uid);
      io.to(`user:${peerId}`).emit("webrtc:ice-candidate", {
        callId: String(callId),
        candidate,
        from: uid,
      });
    });

    socket.on("disconnect", () => {
      const ended = endCallForUser(uid);
      if (ended) {
        io.to(`user:${ended.call.callerId}`).emit("call:ended", {
          callId: ended.callId,
          endedBy: uid,
          reason: "disconnected",
        });
        io.to(`user:${ended.call.calleeId}`).emit("call:ended", {
          callId: ended.callId,
          endedBy: uid,
          reason: "disconnected",
        });
      }

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
