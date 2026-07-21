export function TypingIndicator() {
    return (
        <div className="flex items-center gap-1 px-1 py-1">
            <div className="flex items-center gap-1 rounded-2xl bg-surface px-3 py-2 shadow-sm">
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
            </div>
            <span className="sr-only">Typing</span>
        </div>
    );
}
