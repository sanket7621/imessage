import { useAuth } from "@clerk/clerk-react";
import { Navigate, Route, Routes } from "react-router";
import { ThemeProvider } from "./context/ThemeContext";
import { WallpaperProvider } from "./context/WallpaperContext";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import "./App.css";

function AppRoutes() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background text-foreground">
        Loading…
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={isSignedIn ? <ChatPage /> : <Navigate to="/auth" replace />} />
      <Route path="/auth" element={isSignedIn ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="*" element={<Navigate to={isSignedIn ? "/" : "/auth"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WallpaperProvider>
        <AppRoutes />
      </WallpaperProvider>
    </ThemeProvider>
  );
}

export default App;
