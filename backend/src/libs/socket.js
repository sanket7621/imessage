import { Server } from "socket.io";

const connectedUsers = new Map();

const noopIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
  on: () => {},
};

export let io = noopIo;

function broadcastOnlineUsers(socketServer) {
  const userIds = Array.from(connectedUsers.keys());
  socketServer.emit("getOnlineUsers", userIds);
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

    if (userId) {
      connectedUsers.set(String(userId), socket.id);
      broadcastOnlineUsers(socketServer);
    }

    socket.on("disconnect", () => {
      if (userId) {
        connectedUsers.delete(String(userId));
        broadcastOnlineUsers(socketServer);
      }
    });
  });

  io = socketServer;
  return io;
}

export function getReceiverSocketId(receiverId) {
  return connectedUsers.get(String(receiverId)) || null;
}
