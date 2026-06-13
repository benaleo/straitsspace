import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { LayoutGrid, MessageSquare, Settings2 } from "lucide-react";
import RepDashboard from "@/pages/RepDashboard";
import CustomerChat from "@/pages/CustomerChat";
import AdminDashboard from "@/pages/AdminDashboard";

const TopNav = () => {
  const loc = useLocation();
  const links = [
    { to: "/", label: "Rep Queue", icon: LayoutGrid, testid: "nav-rep" },
    { to: "/chat", label: "Concierge", icon: MessageSquare, testid: "nav-chat" },
    { to: "/admin", label: "Admin", icon: Settings2, testid: "nav-admin" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090A0F]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-2.5" data-testid="brand-wordmark">
          <div className="h-8 w-8 rounded bg-blue-600 grid place-items-center font-display font-extrabold text-white">S</div>
          <div className="leading-none">
            <div className="font-display text-lg font-extrabold tracking-tight">StraitsSpace</div>
            <div className="font-mono text-[10px] text-slate-500 -mt-0.5">by StraitsX · Pak Budi AI</div>
          </div>
        </NavLink>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = loc.pathname === l.to;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={l.testid}
                className={`flex items-center gap-2 px-3.5 py-2 rounded text-sm font-medium transition-colors duration-200 ${
                  active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <l.icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">{l.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

function App() {
  return (
    <div className="App grain min-h-screen">
      <BrowserRouter>
        <TopNav />
        <Routes>
          <Route path="/" element={<RepDashboard />} />
          <Route path="/chat" element={<CustomerChat />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-right" />
    </div>
  );
}

export default App;
