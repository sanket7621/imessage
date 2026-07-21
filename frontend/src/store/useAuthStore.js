import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL = "/";

function toOnlineSet(userIds) {
    return new Set(Array.isArray(userIds) ? userIds.map(String) : []);
}

function seedLastSeenFromUsers(users, existing = {}) {
    const next = { ...existing };
    for (const user of users) {
        if (user?.lastSeenAt) {
            next[String(user._id)] = user.lastSeenAt;
        }
    }
    return next;
}

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isCheckingAuth: true,
    onlineUsers: new Set(),
    lastSeenByUser: {},
    socket: null,

    checkAuth: async () => {
        const isInitialLoad = !get().authUser;
        if (isInitialLoad) set({ isCheckingAuth: true });

        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data });
            get().connectSocket(res.data);
        } catch (error) {
            console.error("Error in checkAuth:", error);
            set({ authUser: null });
            get().disconnectSocket();
        } finally {
            if (isInitialLoad) set({ isCheckingAuth: false });
        }
    },

    clearAuth: () => {
        set({ authUser: null, isCheckingAuth: false, onlineUsers: new Set(), lastSeenByUser: {} });
        get().disconnectSocket();
    },

    connectSocket: (user) => {
        if (!user) return;

        const userId = String(user._id);
        const existingSocket = get().socket;

        if (existingSocket?.connected && existingSocket.io.opts.query?.userId === userId) {
            return;
        }

        existingSocket?.removeAllListeners();
        existingSocket?.disconnect();

        const socket = io(BASE_URL, {
            query: { userId },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 500,
            reconnectionDelayMax: 3000,
        });

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: toOnlineSet(userIds) });
        });

        socket.on("userOnline", (id) => {
            set((state) => {
                const next = new Set(state.onlineUsers);
                next.add(String(id));
                return { onlineUsers: next };
            });
        });

        socket.on("userOffline", (id) => {
            set((state) => {
                const next = new Set(state.onlineUsers);
                next.delete(String(id));
                return { onlineUsers: next };
            });
        });

        socket.on("userLastSeen", ({ userId, lastSeenAt }) => {
            if (!userId || !lastSeenAt) return;
            set((state) => ({
                lastSeenByUser: {
                    ...state.lastSeenByUser,
                    [String(userId)]: lastSeenAt,
                },
            }));
        });

        set({ socket });
    },

    seedLastSeenFromUsers: (users) => {
        set((state) => ({
            lastSeenByUser: seedLastSeenFromUsers(users, state.lastSeenByUser),
        }));
    },

    disconnectSocket: () => {
        const socket = get().socket;
        socket?.removeAllListeners();
        if (socket?.connected) socket.disconnect();
        set({ socket: null, onlineUsers: new Set(), lastSeenByUser: {} });
    },
}));
