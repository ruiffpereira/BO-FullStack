import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Shell } from "./components/Shell";
import { Login } from "./components/Login";
import { SetupPassword } from "./pages/SetupPassword";
import { Dashboard } from "./pages/Dashboard";
import { Financeiro } from "./pages/Financeiro";
import { Despesas } from "./pages/Despesas";
import { Clientes } from "./pages/Clientes";
import { Loja } from "./pages/Loja";
import { Agenda } from "./pages/Agenda";
import { Admin } from "./pages/Admin";
import { Conteudos } from "./pages/Conteudos";
import { Ginasio } from "./pages/Ginasio";

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.setProperty(
      "--accent-hex",
      theme === "dark" ? "#4C86F0" : "#2A6FDB",
    );
    root.style.setProperty(
      "--accent",
      theme === "dark" ? "76 134 240" : "42 111 219",
    );
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // Public routes — accessible without authentication
  if (location.pathname === "/setup-password") {
    return <SetupPassword theme={theme} onToggleTheme={toggleTheme} />;
  }

  // Restoring session (silent refresh on startup) — avoid flashing the login screen
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-300 border-t-accent animate-spin dark:border-zinc-700 dark:border-t-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <Shell theme={theme} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/despesas" element={<Despesas />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/loja" element={<Loja />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/ginasio" element={<Ginasio />} />
        <Route path="/conteudos" element={<Conteudos />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;
