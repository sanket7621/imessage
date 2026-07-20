import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL = "/";

function toOnlineSet(userIds) {
    return new Set(Array.isArray(userIds) ? userIds.map(String) : []);
}

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isCheckingAuth: true,
    onlineUsers: new Set(),
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
        set({ authUser: null, isCheckingAuth: false, onlineUsers: new Set() });
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

        set({ socket });
    },

    disconnectSocket: () => {
        const socket = get().socket;
        socket?.removeAllListeners();
        if (socket?.connected) socket.disconnect();
        set({ socket: null, onlineUsers: new Set() });
    },
}));
