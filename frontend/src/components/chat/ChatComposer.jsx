import { Button, TextArea } from "@heroui/react";
import { ImageIcon, LoaderIcon, SendHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import useKeyboardSound from "../../hooks/useKeyboardSound";
import { useChatStore } from "../../store/useChatStore";
import { useSelectedConversation } from "../../hooks/useSelectedConversation";

export function ChatComposer() {
    const composerText = useChatStore((state) => state.composerText);
    const editingMessageId = useChatStore((state) => state.editingMessageId);
    const isSoundEnabled = useChatStore((state) => state.isSoundEnabled);
    const sendMediaMessage = useChatStore((state) => state.sendMediaMessage);
    const isSendingMedia = useChatStore((state) => state.isSendingMedia);
    const sendTextMessage = useChatStore((state) => state.sendTextMessage);
    const setComposerText = useChatStore((state) => state.setComposerText);
    const cancelEditingMessage = useChatStore((state) => state.cancelEditingMessage);
    const emitTyping = useChatStore((state) => state.emitTyping);
    const stopTyping = useChatStore((state) => state.stopTyping);
    const { activeConversationId } = useSelectedConversation();
    const { playRandomKeyStrokeSound } = useKeyboardSound();
    const mediaInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    const isEditing = Boolean(editingMessageId);

    const clearTypingTimeout = () => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    };

    const endTyping = () => {
        clearTypingTimeout();
        if (!isTypingRef.current || !activeConversationId) return;
        isTypingRef.current = false;
        stopTyping(activeConversationId);
    };

    useEffect(() => {
        return () => {
            clearTypingTimeout();
            if (isTypingRef.current && activeConversationId) {
                stopTyping(activeConversationId);
                isTypingRef.current = false;
            }
        };
    }, [activeConversationId, stopTyping]);

    const playSoundIfEnabled = () => {
        if (isSoundEnabled) playRandomKeyStrokeSound();
    };

    const handleSend = async () => {
        endTyping();
        const didSendMessage = await sendTextMessage(activeConversationId);
        if (didSendMessage) playSoundIfEnabled();
    };

    const handleComposerTextChange = (event) => {
        const nextText = event.target.value;
        setComposerText(nextText);
        playSoundIfEnabled();

        if (!activeConversationId || isEditing) return;

        if (!nextText.trim()) {
            endTyping();
            return;
        }

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            emitTyping(activeConversationId);
        }

        clearTypingTimeout();
        typingTimeoutRef.current = setTimeout(endTyping, 2000);
    };

    const handleMediaPick = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const didSendMessage = await sendMediaMessage({
            conversationId: activeConversationId,
            file,
        });

        if (didSendMessage) playSoundIfEnabled();
    };

    return (
        <footer className="shrink-0 border-t border-border px-1.5 pb-2 pt-2 sm:px-2">
            {isEditing ? (
                <div className="mx-auto mb-2 flex max-w-full items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
                    <span className="truncate font-medium text-accent">Editing message</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        isIconOnly
                        className="size-7 shrink-0"
                        aria-label="Cancel edit"
                        onPress={cancelEditingMessage}
                    >
                        <XIcon className="size-4" strokeWidth={2} />
                    </Button>
                </div>
            ) : null}
            {isSendingMedia ? (
                <div className="mx-auto mb-2 flex max-w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted">
                    <LoaderIcon
                        className="size-4 shrink-0 animate-spin text-accent"
                        strokeWidth={2}
                        aria-hidden
                    />
                    <span className="truncate">Uploading media...</span>
                </div>
            ) : null}
            <div className="mx-auto flex w-full max-w-full items-end gap-1.5 px-0.5 sm:gap-2 sm:px-1">
                <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    disabled={isSendingMedia}
                    tabIndex={-1}
                    aria-hidden
                    onChange={handleMediaPick}
                />
                <Button
                    variant="ghost"
                    isIconOnly
                    isDisabled={isSendingMedia || isEditing}
                    className="size-9 shrink-0 touch-manipulation self-end text-accent"
                    onPress={() => mediaInputRef.current?.click()}
                >
                    <ImageIcon className="size-5 sm:size-6" strokeWidth={2} />
                </Button>
                <TextArea
                    fullWidth
                    variant="secondary"
                    placeholder={isEditing ? "Edit message" : "iMessage"}
                    rows={1}
                    value={composerText}
                    onChange={handleComposerTextChange}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            handleSend();
                        }
                    }}
                    className="flex-1 rounded-full"
                />

                <Button variant="primary" isIconOnly isDisabled={!composerText.trim()} onPress={handleSend}>
                    <SendHorizontalIcon className="size-5" />
                    <span className="sr-only">{isEditing ? "Save edit" : "Send message"}</span>
                </Button>
            </div>
        </footer>
    );
}