import { Server } from "socket.io";

const connectedUsers = new Map();

const noopIo = {
  to: () => ({ emit: () => {} }),
  emit: () => {},
  on: () => {},
};

export let io = noopIo;

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
      connectedUsers.set(userId, socket.id);
    }

    socket.on("disconnect", () => {
      if (userId) {
        connectedUsers.delete(userId);
      }
    });
  });

  io = socketServer;
  return io;
}

export function getReceiverSocketId(receiverId) {
  return connectedUsers.get(receiverId) || null;
}
