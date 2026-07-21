export function formatMessageTime(date) {
    return new Date(date).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatLastSeen(date) {
    if (!date) return "Offline";

    const then = new Date(date);
    if (Number.isNaN(then.getTime())) return "Offline";

    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Last seen just now";
    if (diffMin < 60) return `Last seen ${diffMin} min ago`;
    if (diffHour < 24) return `Last seen ${diffHour}h ago`;
    if (diffDay === 1) return "Last seen yesterday";
    if (diffDay < 7) return `Last seen ${diffDay} days ago`;

    return `Last seen ${then.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}