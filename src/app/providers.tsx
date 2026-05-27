"use client";

import React, { useEffect } from "react";
import { AppProvider } from "@/context/AppContext";
import { ToastProvider } from "@/components/ToastProvider";
import { ThemeProvider } from "@/context/ThemeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => console.log("Service Worker registered:", reg.scope))
          .catch((err) => console.warn("Service Worker registration failed:", err));
      });
    }
  }, []);

  return (
    <ThemeProvider>
      <AppProvider>
        <ToastProvider>{children}</ToastProvider>
      </AppProvider>
    </ThemeProvider>
  );
}

