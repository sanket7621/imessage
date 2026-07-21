import { create } from "zustand";

/** @typedef {'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended'} CallStatus */

/**
 * @typedef {Object} CallPeer
 * @property {string} id
 * @property {string} name
 * @property {string} avatarUrl
 * @property {string} initials
 */

export const useCallStore = create((set) => ({
    status: "idle",
    callId: null,
    remoteUser: null,
    isMuted: false,
    startedAt: null,
    error: null,

    reset: () =>
        set({
            status: "idle",
            callId: null,
            remoteUser: null,
            isMuted: false,
            startedAt: null,
            error: null,
        }),

    setOutgoing: (callId, remoteUser) =>
        set({
            status: "outgoing",
            callId,
            remoteUser,
            isMuted: false,
            startedAt: null,
            error: null,
        }),

    setIncoming: (callId, remoteUser) =>
        set({
            status: "incoming",
            callId,
            remoteUser,
            isMuted: false,
            startedAt: null,
            error: null,
        }),

    setConnecting: () => set({ status: "connecting", error: null }),

    setActive: () => set({ status: "active", startedAt: Date.now(), error: null }),

    setEnded: () => set({ status: "ended" }),

    setError: (error) => set({ error }),

    setMuted: (isMuted) => set({ isMuted }),
}));
