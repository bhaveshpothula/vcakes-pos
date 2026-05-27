"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import ThemeToggle from "./ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, X, LogOut, ShoppingCart, LayoutDashboard, 
  Package, BarChart3, Database, Wifi, WifiOff, ShieldCheck, 
  Settings, Plus, Users
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout, isOnline } = useApp();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  const navLinks = [
    { name: "POS Billing", href: "/pos", icon: ShoppingCart, roles: ["ADMIN", "STAFF"] },
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "STAFF"] },
    { name: "Inventory", href: "/inventory", icon: Package, roles: ["ADMIN"] },
    { name: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN"] },
    { name: "Backups", href: "/backups", icon: Database, roles: ["ADMIN"] },
  ];

  const activeLinks = navLinks.filter(link => link.roles.includes(user.role));

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b border-bakery-border bg-bakery-card/90 backdrop-blur-md shadow-sm transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left Section: Menu Button & Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2.5 rounded-lg border border-bakery-border bg-bakery-background hover:border-bakery-orange/40 hover:bg-bakery-orange/5 text-bakery-foreground/80 hover:text-bakery-orange transition-all cursor-pointer flex items-center gap-2 shadow-xs group"
                title="Open Workspace Menu"
              >
                <Menu className="w-5 h-5 group-hover:scale-105 transition-transform" />
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Workspace Menu</span>
              </button>

              <div className="flex items-center gap-2 border-l border-bakery-border pl-3">
                <Link href="/pos" className="flex items-center gap-2 group">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" className="w-16 h-16 transition-transform duration-300 group-hover:scale-105">
                    <g transform="translate(60, 42)" stroke="currentColor" className="text-bakery-orange" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                      <g transform="rotate(0)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(45)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(90)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(135)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(180)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(225)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(270)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(315)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                    </g>
                    <text x="60" y="98" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="24" fontWeight="bold" fill="currentColor" className="text-bakery-orange" letterSpacing="-0.5">Vcakes</text>
                  </svg>
                  <span className="hidden sm:inline text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full border border-bakery-orange/30 text-bakery-orange bg-bakery-orange/5 uppercase">
                    POS
                  </span>
                </Link>
              </div>
            </div>

            {/* Desktop Direct Nav Links (Center) */}
            <div className="hidden lg:flex items-center space-x-1">
              {activeLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      isActive
                        ? "bg-bakery-orange/10 text-bakery-orange border-bakery-orange/20 shadow-xs"
                        : "text-bakery-foreground/70 border-transparent hover:text-bakery-orange hover:bg-bakery-orange/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.name}
                  </Link>
                );
              })}
            </div>

            {/* Right Section: Connection, Profile, Theme, Logout */}
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-bakery-border bg-bakery-background">
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 hidden md:inline">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span className="text-amber-600 dark:text-amber-400 hidden md:inline">Offline POS</span>
                  </>
                )}
              </div>

              {/* Profile Info (Desktop Only) */}
              <div className="hidden md:flex flex-col text-right justify-center">
                <span className="text-xs font-bold leading-tight">{user.name}</span>
              </div>

              <ThemeToggle />

              {/* Logout Button (Desktop Only) */}
              <button
                onClick={logout}
                className="p-2 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all cursor-pointer hidden md:inline-block"
                title="Logout"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Slide-out Sidebar Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 flex justify-start bg-black/70 backdrop-blur-xs">
            {/* Overlay */}
            <div className="absolute inset-0" onClick={() => setIsSidebarOpen(false)} />

            {/* Sidebar content */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xs h-full bg-bakery-card border-r border-bakery-orange/20 shadow-2xl flex flex-col z-10 text-bakery-foreground font-sans"
            >
              {/* Sidebar Header */}
              <div className="p-4 border-b border-bakery-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" className="w-16 h-16">
                    <g transform="translate(60, 42)" stroke="currentColor" className="text-bakery-orange" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                      <g transform="rotate(0)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(45)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(90)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(135)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(180)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(225)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(270)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                      <g transform="rotate(315)"><path d="M -6 -16 L 0 -8 L 6 -16" /></g>
                    </g>
                    <text x="60" y="98" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="24" fontWeight="bold" fill="currentColor" className="text-bakery-orange" letterSpacing="-0.5">Vcakes</text>
                  </svg>
                  <div>
                    <h3 className="font-extrabold text-sm text-bakery-foreground leading-tight">Vcakes Workspace</h3>
                    <p className="text-[10px] text-bakery-orange font-bold">SYSTEM NAVIGATION</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-full hover:bg-black/30 border border-bakery-orange/10 text-bakery-muted hover:text-bakery-foreground transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sidebar Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
                {/* Navigation Links Group */}
                <div className="space-y-2">
                  <span className="block text-[9px] font-black text-bakery-muted uppercase tracking-widest pl-2">Workspace Menus</span>
                  <div className="space-y-1">
                    {activeLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                            isActive
                              ? "bg-bakery-orange/10 text-bakery-orange border-bakery-orange/20"
                              : "text-bakery-muted-foreground border-transparent hover:bg-bakery-orange/5 hover:text-bakery-orange"
                          }`}
                        >
                          <Icon className="w-4.5 h-4.5" />
                          {link.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Admin Navigation Links */}
                {isAdmin && (
                  <div className="space-y-2">
                    <span className="block text-[9px] font-black text-bakery-muted uppercase tracking-widest pl-2">Administration</span>
                    <div className="space-y-1">
                      <Link
                        href="/inventory"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                          pathname === "/inventory" ? "bg-bakery-orange/10 text-bakery-orange border-bakery-orange/20" : "text-bakery-muted-foreground border-transparent hover:bg-bakery-orange/5 hover:text-bakery-orange"
                        }`}
                      >
                        <Package className="w-4.5 h-4.5" />
                        Products Management
                      </Link>
                      <Link
                        href="/inventory?tab=categories"
                        onClick={() => setIsSidebarOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border text-bakery-muted-foreground border-transparent hover:bg-bakery-orange/5 hover:text-bakery-orange"
                      >
                        <Settings className="w-4.5 h-4.5" />
                        Categories Management
                      </Link>
                      <Link
                        href="/reports"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                          pathname === "/reports" ? "bg-bakery-orange/10 text-bakery-orange border-bakery-orange/20" : "text-bakery-muted-foreground border-transparent hover:bg-bakery-orange/5 hover:text-bakery-orange"
                        }`}
                      >
                        <BarChart3 className="w-4.5 h-4.5" />
                        Sales History & Logs
                      </Link>
                      <Link
                        href="/audit-logs"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                          pathname === "/audit-logs" ? "bg-bakery-orange/10 text-bakery-orange border-bakery-orange/20" : "text-bakery-muted-foreground border-transparent hover:bg-bakery-orange/5 hover:text-bakery-orange"
                        }`}
                      >
                        <ShieldCheck className="w-4.5 h-4.5" />
                        Security Audit Logs
                      </Link>
                      <Link
                        href="/backups"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                          pathname === "/backups" ? "bg-bakery-orange/10 text-bakery-orange border-bakery-orange/20" : "text-bakery-muted-foreground border-transparent hover:bg-bakery-orange/5 hover:text-bakery-orange"
                        }`}
                      >
                        <Database className="w-4.5 h-4.5" />
                        System settings
                      </Link>
                    </div>
                  </div>
                )}

                {/* Quick actions panel */}
                {isAdmin && (
                  <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-bakery-orange/10">
                    <span className="block text-[9px] font-black text-bakery-orange/80 uppercase tracking-widest">Quick Actions</span>
                    <div className="grid grid-cols-1 gap-2">
                      <Link
                        href="/inventory?action=add-item"
                        onClick={() => setIsSidebarOpen(false)}
                        className="py-2 px-3 rounded-lg bg-bakery-orange hover:bg-bakery-orange-dark text-white text-[11px] font-bold text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Product
                      </Link>
                      <Link
                        href="/inventory?action=add-category"
                        onClick={() => setIsSidebarOpen(false)}
                        className="py-2 px-3 rounded-lg border border-bakery-orange/30 hover:border-bakery-orange/60 bg-transparent text-bakery-foreground hover:bg-bakery-orange/5 text-[11px] font-bold text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Category
                      </Link>

                      <Link
                        href="/backups?action=backup"
                        onClick={() => setIsSidebarOpen(false)}
                        className="py-2 px-3 rounded-lg border border-transparent hover:border-bakery-orange/30 bg-bakery-muted/20 hover:bg-bakery-muted/30 text-bakery-foreground text-[11px] font-bold text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5" /> Backup Database
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Footer */}
              <div className="p-4 border-t border-bakery-border bg-bakery-background/40 space-y-4">
                {/* Connection details */}
                <div className="flex items-center justify-between text-xs text-bakery-muted">
                  <span className="font-semibold">Network:</span>
                  <div className="flex items-center gap-1.5">
                    {isOnline ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="text-emerald-500 font-bold">Online</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <span className="text-amber-500 font-bold">Offline Backup</span>
                      </>
                    )}
                  </div>
                </div>

                {/* User Card */}
                <div className="flex items-center justify-between border-t border-bakery-border pt-3">
                  <div className="flex flex-col justify-center">
                    <span className="text-xs font-bold text-bakery-foreground">{user.name}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="p-2 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50/10 border border-rose-500/20 hover:border-rose-500/40 transition-all cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
export default Navbar;
