import { Button } from "@heroui/react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { withTransform } from "../../lib/imagekit";
import { MessageVideo } from "./MessageVideo";

// Compress + size images for the bubble (q-auto works for images; f-auto picks WebP/AVIF).
const IMAGE_TRANSFORM = "q-auto,w-640,f-auto";

export function MessageBubble({ message, onEdit, onDelete }) {
    const isOwnMessage = message.role === "me";
    const hasImage = Boolean(message.imageUrl);
    const hasVideo = Boolean(message.videoUrl);
    const showActions = isOwnMessage && (message.canEdit || message.canDelete);

    return (
        <div className={`group flex w-full ${isOwnMessage ? "justify-end" : "justify-start"}`}>
            <div className="flex max-w-[min(90%,28rem)] items-end gap-1 sm:max-w-[min(75%,28rem)]">
                {showActions ? (
                    <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {message.canEdit ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconOnly
                                className="size-7 min-w-7 text-muted"
                                aria-label="Edit message"
                                onPress={() => onEdit?.(message)}
                            >
                                <PencilIcon className="size-3.5" strokeWidth={2} />
                            </Button>
                        ) : null}
                        {message.canDelete ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                isIconOnly
                                className="size-7 min-w-7 text-danger"
                                aria-label="Delete message"
                                onPress={() => onDelete?.(message)}
                            >
                                <Trash2Icon className="size-3.5" strokeWidth={2} />
                            </Button>
                        ) : null}
                    </div>
                ) : null}

                <div
                    className={`rounded-2xl px-3 py-2 text-[15px] leading-snug sm:px-3.5 ${
                        isOwnMessage
                            ? "rounded-br-md bg-accent text-accent-foreground"
                            : "rounded-bl-md bg-surface"
                    }`}
                >
                    {hasImage ? (
                        <img
                            src={withTransform(message.imageUrl, IMAGE_TRANSFORM)}
                            alt=""
                            className="mb-1.5 max-h-40 max-w-full rounded-lg object-cover sm:max-h-52 sm:rounded-xl"
                        />
                    ) : null}
                    {hasVideo ? <MessageVideo src={message.videoUrl} /> : null}
                    {message.text ? (
                        <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
                    ) : null}
                    <p
                        className={`mt-1 text-[11px] tabular-nums ${
                            isOwnMessage ? "text-accent-foreground/75" : "text-muted"
                        }`}
                    >
                        {message.time}
                        {message.isEdited ? <span className="ml-1.5 italic opacity-80">Edited</span> : null}
                    </p>
                </div>
            </div>
        </div>
    );
}
