import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { io } from "socket.io-client";

const BASE_URL = "/";

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isCheckingAuth: true,
    onlineUsers: [],
    socket: null,

    checkAuth: async () => {
        set({ isCheckingAuth: true });

        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data });

            get().connectSocket(res.data);
        } catch (error) {
            console.error("Error in checkAuth:", error);
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    clearAuth: () => {
        set({ authUser: null, isCheckingAuth: false, onlineUsers: [] });
        get().disconnectSocket();
    },

    connectSocket: (user) => {
        if (!user) return;

        const existingSocket = get().socket;
        if (existingSocket?.connected) return;

        existingSocket?.disconnect();

        const socket = io(BASE_URL, { query: { userId: String(user._id) } });

        set({ socket });

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: Array.isArray(userIds) ? userIds.map(String) : [] });
        });
    },

    disconnectSocket: () => {
        const socket = get().socket;
        if (socket?.connected) socket.disconnect();
        set({ socket: null });
    },
}));