import { create } from "zustand";
import { persist } from "zustand/middleware";

import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

function isMessageInConversation(message, conversationUserId, authUserId) {
    const partnerId = String(conversationUserId);
    const senderId = String(message.senderId);
    const receiverId = String(message.receiverId);
    const me = String(authUserId);

    return (
        (senderId === me && receiverId === partnerId) ||
        (senderId === partnerId && receiverId === me)
    );
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const typingExpiryTimers = new Map();

function clearTypingExpiry(userId) {
    const timer = typingExpiryTimers.get(String(userId));
    if (timer) {
        clearTimeout(timer);
        typingExpiryTimers.delete(String(userId));
    }
}

function scheduleTypingExpiry(userId, onExpire) {
    const id = String(userId);
    clearTypingExpiry(id);
    typingExpiryTimers.set(
        id,
        setTimeout(() => {
            typingExpiryTimers.delete(id);
            onExpire(id);
        }, 3000),
    );
}

export const useChatStore = create(
    persist(
        (set, get) => ({
            users: [],
            conversations: [],
            messages: [],
            selectedUser: null,
            isConversationsLoading: false,
            isUsersLoading: false,
            isMessagesLoading: false,
            activeConversationId: null,
            searchQuery: "",
            sidebarTab: "chats",
            composerText: "",
            editingMessageId: null,
            isSoundEnabled: true,
            isSendingMedia: false,
            typingByUserId: {},

            getUsers: async () => {
                set({ isUsersLoading: true });
                try {
                    const res = await axiosInstance.get("/message/users");
                    const users = Array.isArray(res.data) ? res.data : [];
                    useAuthStore.getState().seedLastSeenFromUsers(users);
                    set((state) => ({
                        users,
                        selectedUser:
                            state.selectedUser && res.data.some((user) => user._id === state.selectedUser._id)
                                ? state.selectedUser
                                : null,
                    }));
                } catch (error) {
                    console.log("Error in get Users", error.message);
                } finally {
                    set({ isUsersLoading: false });
                }
            },

            getConversations: async () => {
                set({ isConversationsLoading: true });
                try {
                    const res = await axiosInstance.get("/message/conversations");
                    const conversations = Array.isArray(res.data) ? res.data : [];
                    useAuthStore.getState().seedLastSeenFromUsers(conversations);
                    set({ conversations });
                } catch (error) {
                    console.log("Error in getConversations", error.message);
                } finally {
                    set({ isConversationsLoading: false });
                }
            },

            getMessages: async (userId) => {
                if (!userId) return;
                set({ isMessagesLoading: true });
                try {
                    const res = await axiosInstance.get(`/message/${userId}`);
                    set({ messages: Array.isArray(res.data) ? res.data : [] });
                } catch (error) {
                    toast.error(error.response?.data?.message || "Failed to load messages");
                } finally {
                    set({ isMessagesLoading: false });
                }
            },

            sendMessage: async (messageData) => {
                const { selectedUser, messages } = get();
                if (!selectedUser) return false;

                try {
                    const res = await axiosInstance.post(`/message/send/${selectedUser._id}`, messageData);
                    get().stopTyping(selectedUser._id);
                    set({ messages: [...messages, res.data], composerText: "" });
                    get().getConversations();
                    return true;
                } catch (error) {
                    toast.error(error.response?.data?.message || "Failed to send message");
                    return false;
                }
            },

            updateMessage: async (messageId, text) => {
                const trimmedText = text.trim();
                if (!messageId || !trimmedText) return false;

                try {
                    const res = await axiosInstance.patch(`/message/edit/${messageId}`, { text: trimmedText });
                    set({
                        messages: get().messages.map((message) =>
                            message._id === messageId ? res.data : message,
                        ),
                        composerText: "",
                        editingMessageId: null,
                    });
                    get().getConversations();
                    return true;
                } catch (error) {
                    toast.error(error.response?.data?.message || "Failed to update message");
                    return false;
                }
            },

            deleteMessage: async (messageId) => {
                if (!messageId) return false;

                try {
                    await axiosInstance.delete(`/message/remove/${messageId}`);
                    set({
                        messages: get().messages.filter((message) => message._id !== messageId),
                        editingMessageId:
                            get().editingMessageId === messageId ? null : get().editingMessageId,
                        composerText: get().editingMessageId === messageId ? "" : get().composerText,
                    });
                    get().getConversations();
                    return true;
                } catch (error) {
                    toast.error(error.response?.data?.message || "Failed to delete message");
                    return false;
                }
            },

            startEditingMessage: (message) => {
                if (!message?.text) return;
                set({ editingMessageId: message.id, composerText: message.text });
            },

            cancelEditingMessage: () => {
                set({ editingMessageId: null, composerText: "" });
            },

            subscribeToMessages: (userId) => {
                if (!userId) return;

                const socket = useAuthStore.getState().socket;
                if (!socket) return;

                const authUserId = useAuthStore.getState().authUser?._id;

                socket.off("newMessage");
                socket.off("messageUpdated");
                socket.off("messageDeleted");
                socket.off("userTyping");
                socket.off("userStoppedTyping");

                socket.on("newMessage", (newMessage) => {
                    if (!isMessageInConversation(newMessage, userId, authUserId)) return;
                    if (get().messages.some((message) => message._id === newMessage._id)) return;

                    set({ messages: [...get().messages, newMessage] });
                    get().getConversations();
                });

                socket.on("messageUpdated", (updatedMessage) => {
                    if (!isMessageInConversation(updatedMessage, userId, authUserId)) return;

                    set({
                        messages: get().messages.map((message) =>
                            message._id === updatedMessage._id ? updatedMessage : message,
                        ),
                    });
                    get().getConversations();
                });

                socket.on("messageDeleted", ({ _id }) => {
                    if (!_id) return;

                    const wasInConversation = get().messages.some((message) => message._id === _id);
                    if (!wasInConversation) return;

                    set({
                        messages: get().messages.filter((message) => message._id !== _id),
                        editingMessageId: get().editingMessageId === _id ? null : get().editingMessageId,
                        composerText: get().editingMessageId === _id ? "" : get().composerText,
                    });
                    get().getConversations();
                });

                socket.on("userTyping", ({ userId: typingUserId }) => {
                    if (String(typingUserId) !== String(userId)) return;

                    set((state) => ({
                        typingByUserId: { ...state.typingByUserId, [String(typingUserId)]: true },
                    }));

                    scheduleTypingExpiry(typingUserId, (expiredUserId) => {
                        set((state) => {
                            if (!state.typingByUserId[expiredUserId]) return state;
                            const next = { ...state.typingByUserId };
                            delete next[expiredUserId];
                            return { typingByUserId: next };
                        });
                    });
                });

                socket.on("userStoppedTyping", ({ userId: typingUserId }) => {
                    if (String(typingUserId) !== String(userId)) return;

                    clearTypingExpiry(typingUserId);
                    set((state) => {
                        const next = { ...state.typingByUserId };
                        delete next[String(typingUserId)];
                        return { typingByUserId: next };
                    });
                });
            },

            unsubscribeFromMessages: () => {
                const socket = useAuthStore.getState().socket;
                socket?.off("newMessage");
                socket?.off("messageUpdated");
                socket?.off("messageDeleted");
                socket?.off("userTyping");
                socket?.off("userStoppedTyping");
                typingExpiryTimers.forEach((timer) => clearTimeout(timer));
                typingExpiryTimers.clear();
                set({ typingByUserId: {} });
            },

            emitTyping: (receiverId) => {
                const socket = useAuthStore.getState().socket;
                if (!socket || !receiverId) return;
                socket.emit("typing", { receiverId });
            },

            stopTyping: (receiverId) => {
                const socket = useAuthStore.getState().socket;
                if (!socket || !receiverId) return;
                socket.emit("stopTyping", { receiverId });
            },

            setSelectedUser: (selectedUser) => set({ selectedUser }),

            setActiveConversationId: (activeConversationId) => {
                const previousId = get().activeConversationId;
                if (previousId && previousId !== activeConversationId) {
                    get().stopTyping(previousId);
                }

                set((state) => ({
                    activeConversationId,
                    selectedUser:
                        state.users.find((user) => user._id === activeConversationId) ||
                        state.conversations.find((user) => user._id === activeConversationId) ||
                        null,
                    messages: activeConversationId ? state.messages : [],
                    editingMessageId: null,
                    composerText: "",
                    typingByUserId: {},
                }));
            },

            setSearchQuery: (searchQuery) => set({ searchQuery }),
            setSidebarTab: (sidebarTab) => set({ sidebarTab }),
            setComposerText: (composerText) => set({ composerText }),
            setSoundEnabled: (isSoundEnabled) => set({ isSoundEnabled }),

            sendTextMessage: async (conversationId) => {
                const messageText = get().composerText.trim();
                if (!conversationId || !messageText) return false;

                const editingMessageId = get().editingMessageId;
                if (editingMessageId) {
                    return get().updateMessage(editingMessageId, messageText);
                }

                return get().sendMessage({ text: messageText });
            },

            sendMediaMessage: async ({ conversationId, file }) => {
                if (!conversationId || !file) return false;

                const formData = new FormData();
                formData.append("media", file);

                set({ isSendingMedia: true });
                try {
                    return await get().sendMessage(formData);
                } finally {
                    set({ isSendingMedia: false });
                }
            },
        }),
        {
            name: "imessage-storage",
            partialize: (state) => ({ isSoundEnabled: state.isSoundEnabled }),
        },
    ),
);