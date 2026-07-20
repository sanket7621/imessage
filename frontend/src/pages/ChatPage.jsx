import { UserButton, useUser } from "@clerk/clerk-react";

function ChatPage() {
  const { user } = useUser();

  return (
    <main className="app-shell">
      <header>
        <h1>iMessage</h1>
        <UserButton />
      </header>
      <p>Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.</p>
      <p>Your chat interface will appear here.</p>
    </main>
  );
}

export default ChatPage;
