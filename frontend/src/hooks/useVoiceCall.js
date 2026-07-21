import { useEffect } from "react";

import { destroyCallService, initCallService } from "../lib/callService";
import { useAuthStore } from "../store/useAuthStore";

export function useVoiceCall() {
    const socket = useAuthStore((state) => state.socket);
    const authUser = useAuthStore((state) => state.authUser);

    useEffect(() => {
        if (!socket || !authUser?._id) return;

        initCallService(socket, authUser._id);
        return () => destroyCallService();
    }, [socket, authUser?._id]);
}
