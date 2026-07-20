import { ThemeProvider } from "./context/ThemeContext";
import { WallpaperProvider } from "./context/WallpaperContext";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <WallpaperProvider>
        <main className="app-shell">
          <h1>iMessage</h1>
          <p>Your messaging app is ready to connect.</p>
        </main>
      </WallpaperProvider>
    </ThemeProvider>
  );
}

export default App;
