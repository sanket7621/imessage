import toast from "react-hot-toast";

import { axiosInstance } from "./axios";
import { useCallStore } from "../store/useCallStore";

const RING_TIMEOUT_MS = 30_000;
const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

/** @type {import("socket.io-client").Socket | null} */
let socket = null;
let authUserId = null;

/** @type {RTCPeerConnection | null} */
let peerConnection = null;
/** @type {MediaStream | null} */
let localStream = null;
/** @type {HTMLAudioElement | null} */
let remoteAudio = null;
let ringTimeoutId = null;
let iceServersCache = null;
/** @type {RTCIceCandidateInit[]} */
let pendingCandidates = [];

function getStore() {
    return useCallStore.getState();
}

function clearRingTimeout() {
    if (ringTimeoutId) {
        clearTimeout(ringTimeoutId);
        ringTimeoutId = null;
    }
}

function scheduleRingTimeout() {
    clearRingTimeout();
    ringTimeoutId = setTimeout(() => {
        const { callId, status } = getStore();
        if (status !== "outgoing" && status !== "incoming") return;
        if (!callId) return;

        if (status === "outgoing") {
            socket?.emit("call:cancel", { callId });
        } else {
            socket?.emit("call:reject", { callId });
        }

        cleanupMedia();
        getStore().setEnded();
        toast.error("No answer");
        setTimeout(() => getStore().reset(), 1500);
    }, RING_TIMEOUT_MS);
}

async function getIceServers() {
    if (iceServersCache) return iceServersCache;

    try {
        const res = await axiosInstance.get("/call/ice-servers");
        iceServersCache = Array.isArray(res.data?.iceServers) ? res.data.iceServers : DEFAULT_ICE_SERVERS;
    } catch {
        iceServersCache = DEFAULT_ICE_SERVERS;
    }

    return iceServersCache;
}

function ensureRemoteAudio() {
    if (!remoteAudio) {
        remoteAudio = new Audio();
        remoteAudio.autoplay = true;
    }
    return remoteAudio;
}

function stopLocalTracks() {
    localStream?.getTracks().forEach((track) => track.stop());
    localStream = null;
}

function closePeerConnection() {
    peerConnection?.close();
    peerConnection = null;
}

function cleanupMedia() {
    clearRingTimeout();
    stopLocalTracks();
    closePeerConnection();
    pendingCandidates = [];
    if (remoteAudio) {
        remoteAudio.srcObject = null;
    }
}

function handleCallEnded({ reason } = {}) {
    cleanupMedia();
    getStore().setEnded();

    if (reason === "rejected") {
        toast.error("Call declined");
    } else if (reason === "cancelled") {
        toast("Call cancelled");
    } else if (reason === "disconnected") {
        toast.error("Call disconnected");
    }

    setTimeout(() => getStore().reset(), 1500);
}

async function getUserMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        return localStream;
    } catch {
        throw new Error("Microphone permission denied");
    }
}

async function createPeerConnection(callId) {
    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    const stream = localStream ?? (await getUserMedia());
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
        if (!event.candidate || !callId) return;
        socket?.emit("webrtc:ice-candidate", { callId, candidate: event.candidate });
    };

    pc.ontrack = (event) => {
        const audio = ensureRemoteAudio();
        audio.srcObject = event.streams[0] ?? null;
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
            clearRingTimeout();
            getStore().setActive();
        }
        if (pc.connectionState === "failed") {
            toast.error("Call connection failed");
            endCall();
        }
    };

    peerConnection = pc;
    return pc;
}

async function startCallerWebRtc(callId) {
    getStore().setConnecting();

    const pc = await createPeerConnection(callId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit("webrtc:offer", { callId, sdp: pc.localDescription });
}

async function flushPendingCandidates() {
    if (!peerConnection?.remoteDescription) return;

    const candidates = pendingCandidates.splice(0);
    for (const candidate of candidates) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.warn("Failed to add queued ICE candidate:", error);
        }
    }
}

async function handleOffer({ callId, sdp }) {
    const { status, callId: activeCallId } = getStore();
    if (String(callId) !== String(activeCallId)) return;
    if (status !== "incoming" && status !== "connecting") return;

    getStore().setConnecting();
    const pc = await createPeerConnection(callId);
    await pc.setRemoteDescription(sdp);
    await flushPendingCandidates();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit("webrtc:answer", { callId, sdp: pc.localDescription });
}

async function handleAnswer({ callId, sdp }) {
    const { callId: activeCallId } = getStore();
    if (String(callId) !== String(activeCallId) || !peerConnection) return;

    await peerConnection.setRemoteDescription(sdp);
    await flushPendingCandidates();
}

async function handleIceCandidate({ callId, candidate }) {
    const { callId: activeCallId } = getStore();
    if (String(callId) !== String(activeCallId)) return;

    if (!peerConnection?.remoteDescription) {
        pendingCandidates.push(candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.warn("Failed to add ICE candidate:", error);
    }
}

function mapRemoteUser(user, fallbackId) {
    const name = user.fullName || user.name || "Unknown";
    const initials = name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .join("");

    return {
        id: String(user.userId || user.id || fallbackId),
        name,
        avatarUrl: user.profilePic || user.avatarUrl || "",
        initials,
    };
}

function attachSocketListeners() {
    if (!socket) return;

    socket.on("call:incoming", ({ callId, caller }) => {
        const { status } = getStore();
        if (status !== "idle" && status !== "ended") return;

        getStore().setIncoming(callId, mapRemoteUser(caller, caller.userId));
        scheduleRingTimeout();
    });

    socket.on("call:initiated", () => {
        scheduleRingTimeout();
    });

    socket.on("call:accepted", async ({ callId }) => {
        const { callId: activeCallId, status } = getStore();
        if (String(callId) !== String(activeCallId) || status !== "outgoing") return;

        try {
            await startCallerWebRtc(callId);
        } catch (error) {
            toast.error(error.message || "Failed to start call");
            endCall();
        }
    });

    socket.on("call:ended", (payload) => {
        const { callId: activeCallId } = getStore();
        if (activeCallId && String(payload.callId) !== String(activeCallId)) return;
        handleCallEnded(payload);
    });

    socket.on("call:error", ({ message, callId }) => {
        const { callId: activeCallId } = getStore();
        if (activeCallId && callId && String(callId) !== String(activeCallId)) return;

        cleanupMedia();
        getStore().setError(message || "Call failed");
        toast.error(message || "Call failed");
        setTimeout(() => getStore().reset(), 1500);
    });

    socket.on("webrtc:offer", (payload) => {
        handleOffer(payload).catch((error) => {
            console.error("Failed to handle offer:", error);
            toast.error("Failed to connect call");
            endCall();
        });
    });

    socket.on("webrtc:answer", (payload) => {
        handleAnswer(payload).catch((error) => {
            console.error("Failed to handle answer:", error);
        });
    });

    socket.on("webrtc:ice-candidate", (payload) => {
        handleIceCandidate(payload).catch((error) => {
            console.warn("ICE candidate error:", error);
        });
    });
}

function detachSocketListeners() {
    socket?.off("call:incoming");
    socket?.off("call:initiated");
    socket?.off("call:accepted");
    socket?.off("call:ended");
    socket?.off("call:error");
    socket?.off("webrtc:offer");
    socket?.off("webrtc:answer");
    socket?.off("webrtc:ice-candidate");
}

export function initCallService(nextSocket, userId) {
    if (socket === nextSocket && authUserId === String(userId)) return;

    destroyCallService();
    socket = nextSocket;
    authUserId = String(userId);
    attachSocketListeners();
}

export function destroyCallService() {
    detachSocketListeners();
    const { callId, status } = getStore();
    if (callId && status !== "idle" && status !== "ended") {
        socket?.emit("call:end", { callId });
    }
    cleanupMedia();
    getStore().reset();
    socket = null;
    authUserId = null;
}

export async function initiateCall(remoteUser) {
    if (!socket || !authUserId) {
        toast.error("Not connected");
        return;
    }

    const { status } = getStore();
    if (status !== "idle" && status !== "ended") {
        toast.error("Already in a call");
        return;
    }

    if (!remoteUser?.id) {
        toast.error("No user selected");
        return;
    }

    if (!remoteUser.isOnline) {
        toast.error("User is offline");
        return;
    }

    const callId = crypto.randomUUID();
    getStore().setOutgoing(callId, {
        id: String(remoteUser.id),
        name: remoteUser.name,
        avatarUrl: remoteUser.avatarUrl,
        initials: remoteUser.initials,
    });

    socket.emit("call:initiate", { callId, calleeId: remoteUser.id });
}

export async function acceptCall() {
    const { callId, status } = getStore();
    if (!socket || !callId || status !== "incoming") return;

    clearRingTimeout();

    try {
        await getUserMedia();
        socket.emit("call:accept", { callId });
        getStore().setConnecting();
    } catch (error) {
        toast.error(error.message || "Microphone permission denied");
        rejectCall();
    }
}

export function rejectCall() {
    const { callId, status } = getStore();
    if (!socket || !callId) return;

    if (status === "incoming") {
        socket.emit("call:reject", { callId });
    }

    cleanupMedia();
    getStore().reset();
}

export function cancelCall() {
    const { callId, status } = getStore();
    if (!socket || !callId) return;

    if (status === "outgoing") {
        socket.emit("call:cancel", { callId });
    } else {
        socket.emit("call:end", { callId });
    }

    cleanupMedia();
    getStore().reset();
}

export function endCall() {
    const { callId } = getStore();
    if (socket && callId) {
        socket.emit("call:end", { callId });
    }
    cleanupMedia();
    getStore().reset();
}

export function toggleMute() {
    const { isMuted } = getStore();
    const nextMuted = !isMuted;

    localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
    });

    getStore().setMuted(nextMuted);
}

export function isInCallWith(userId) {
    const { remoteUser, status } = getStore();
    if (!remoteUser || status === "idle" || status === "ended") return false;
    return String(remoteUser.id) === String(userId);
}
