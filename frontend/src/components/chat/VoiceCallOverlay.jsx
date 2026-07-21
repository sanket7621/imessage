import { Avatar, Button } from "@heroui/react";
import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { acceptCall, cancelCall, endCall, rejectCall, toggleMute } from "../../lib/callService";
import { useCallStore } from "../../store/useCallStore";

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getStatusLabel(status) {
    switch (status) {
        case "outgoing":
            return "Calling...";
        case "incoming":
            return "Incoming call";
        case "connecting":
            return "Connecting...";
        case "active":
            return "On call";
        case "ended":
            return "Call ended";
        default:
            return "";
    }
}

export function VoiceCallOverlay() {
    const status = useCallStore((state) => state.status);
    const remoteUser = useCallStore((state) => state.remoteUser);
    const isMuted = useCallStore((state) => state.isMuted);
    const startedAt = useCallStore((state) => state.startedAt);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (status !== "active" || !startedAt) {
            setElapsed(0);
            return;
        }

        const tick = () => setElapsed(Date.now() - startedAt);
        tick();
        const intervalId = setInterval(tick, 1000);
        return () => clearInterval(intervalId);
    }, [status, startedAt]);

    if (status === "idle" || !remoteUser) return null;

    const isIncoming = status === "incoming";
    const isOutgoing = status === "outgoing";
    const isActive = status === "active" || status === "connecting";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-border bg-background px-6 py-8 shadow-2xl">
                <Avatar className="size-24">
                    <Avatar.Image alt={remoteUser.name} src={remoteUser.avatarUrl} />
                    <Avatar.Fallback className="text-2xl font-semibold">{remoteUser.initials}</Avatar.Fallback>
                </Avatar>

                <div className="text-center">
                    <p className="text-xl font-semibold">{remoteUser.name}</p>
                    <p className="mt-1 text-sm text-muted">
                        {status === "active" ? formatDuration(elapsed) : getStatusLabel(status)}
                    </p>
                </div>

                <div className="flex w-full items-center justify-center gap-4">
                    {isIncoming ? (
                        <>
                            <Button
                                variant="danger"
                                isIconOnly
                                className="size-14 rounded-full"
                                aria-label="Decline call"
                                onPress={rejectCall}
                            >
                                <PhoneOffIcon className="size-6" />
                            </Button>
                            <Button
                                variant="primary"
                                isIconOnly
                                className="size-14 rounded-full bg-[#25D366] text-white"
                                aria-label="Accept call"
                                onPress={acceptCall}
                            >
                                <PhoneIcon className="size-6" />
                            </Button>
                        </>
                    ) : null}

                    {isOutgoing ? (
                        <Button
                            variant="danger"
                            isIconOnly
                            className="size-14 rounded-full"
                            aria-label="Cancel call"
                            onPress={cancelCall}
                        >
                            <PhoneOffIcon className="size-6" />
                        </Button>
                    ) : null}

                    {isActive && !isIncoming && !isOutgoing ? (
                        <>
                            <Button
                                variant="secondary"
                                isIconOnly
                                className="size-14 rounded-full"
                                aria-label={isMuted ? "Unmute" : "Mute"}
                                onPress={toggleMute}
                            >
                                {isMuted ? (
                                    <MicOffIcon className="size-6" />
                                ) : (
                                    <MicIcon className="size-6" />
                                )}
                            </Button>
                            <Button
                                variant="danger"
                                isIconOnly
                                className="size-14 rounded-full"
                                aria-label="End call"
                                onPress={endCall}
                            >
                                <PhoneOffIcon className="size-6" />
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
