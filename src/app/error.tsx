"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console
    console.error("Vcakes POS Route Runtime Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] bg-[var(--background)] px-4 text-center">
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full shadow-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500 animate-pulse">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">
            Something Went Wrong
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Vcakes POS application encountered a temporary rendering or state error.
          </p>
        </div>

        {error.message && (
          <div className="w-full bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] text-left font-mono text-[10px] text-rose-500 break-all max-h-32 overflow-y-auto">
            {error.message}
            {error.digest && <span className="block text-gray-400 mt-1">Digest: {error.digest}</span>}
          </div>
        )}

        <div className="flex gap-3 w-full">
          <button
            onClick={() => window.location.href = "/"}
            className="flex-1 py-3 px-4 rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> Home
          </button>
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-bakery-orange to-bakery-orange-dark hover:from-bakery-orange-dark hover:to-bakery-orange flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-xs shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
