"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/components/ToastProvider";
import { motion } from "framer-motion";
import { LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { refreshUser } = useApp();
  const { showToast } = useToast();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("Please enter both email and password.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`Welcome back, ${data.user.name}!`, "success");
        await refreshUser();
        router.push("/pos");
      } else {
        showToast(data.error || "Login failed. Please check credentials.", "error");
      }
    } catch (error) {
      console.error("Login client error:", error);
      showToast("Network error. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bakery-background px-4 sm:px-6 relative overflow-hidden text-bakery-foreground font-sans">
      {/* Decorative ambient background glows */}
      <div className="absolute top-[-30%] left-[-20%] w-[600px] h-[600px] rounded-full bg-bakery-orange/10 blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[600px] h-[600px] rounded-full bg-bakery-foreground/5 blur-3xl -z-10 pointer-events-none" />
 
      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
 
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center justify-center mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" className="w-32 h-32 mb-2 drop-shadow-[0_4px_12px_rgba(244,122,31,0.3)]">
            <g transform="translate(60, 42)" stroke="#F47A1F" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
              <g transform="rotate(0)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(45)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(90)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(135)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(180)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(225)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(270)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
              <g transform="rotate(315)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
            </g>
            <text x="60" y="98" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="25" fontWeight="bold" fill="currentColor" className="text-bakery-foreground" letterSpacing="-0.5">Vcakes</text>
          </svg>
          <p className="text-xs font-bold text-bakery-muted uppercase tracking-widest mt-1.5">
            Boutique Bakery Owner Workspace
          </p>
        </div>
 
        {/* Premium Dark Glassmorphic Card */}
        <div className="bg-bakery-card/90 backdrop-blur-xl p-8 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-bakery-border relative">
          <h2 className="text-lg font-bold mb-6 text-center border-b border-bakery-border pb-4 flex items-center justify-center gap-2 text-bakery-foreground/90">
            <LogIn className="w-4 h-4 text-bakery-orange" /> POS Login
          </h2>
 
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-bakery-muted-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-bakery-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@vcakes.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all text-sm text-bakery-foreground"
                />
              </div>
            </div>
 
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-bakery-muted-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-bakery-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all text-sm text-bakery-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-bakery-muted hover:text-bakery-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
 
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-bakery-orange to-bakery-orange-dark hover:brightness-110 active:scale-98 transition-all shadow-md shadow-bakery-orange/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying Workspace...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Initialize POS Session
                </>
              )}
            </button>
          </form>
        </div>
 
        <div className="mt-8 text-center text-[10px] text-bakery-muted uppercase tracking-widest">
          <p>© 2026 Vcakes Boutique Bakery.</p>
          <p className="mt-1">All database state events are logged in the transaction ledger.</p>
        </div>
      </motion.div>
    </div>
  );
}
