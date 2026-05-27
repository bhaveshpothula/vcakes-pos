"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex items-center justify-center bg-[#120B08] text-[#FFF4E8] font-sans antialiased p-4">
        <div className="bg-[#1E130F] p-8 rounded-2xl max-w-md w-full text-center border border-[#2E1D16] shadow-2xl flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-500">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold">System Initialization Error</h2>
            <p className="text-xs text-gray-400">
              Vcakes POS layout level failure. Please restart or try refreshing.
            </p>
          </div>

          {error.message && (
            <div className="w-full bg-[#120B08] p-3 rounded-lg border border-[#2E1D16] text-left font-mono text-[10px] text-rose-400 break-all max-h-32 overflow-y-auto">
              {error.message}
            </div>
          )}

          <button
            onClick={() => reset()}
            className="w-full py-3 px-4 rounded-xl text-white font-bold bg-[#F47A1F] hover:bg-[#d35a00] flex items-center justify-center gap-1.5 cursor-pointer transition-colors text-xs shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Recover Session
          </button>
        </div>
      </body>
    </html>
  );
}
