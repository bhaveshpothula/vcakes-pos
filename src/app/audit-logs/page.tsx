"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { ShieldCheck, Search, Loader2, RefreshCw, Info } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  targetTable: string;
  targetId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function AuditLogsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/audit-logs?limit=200");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs);
      } else {
        showToast("Failed to fetch audit logs.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs locally
  const filteredLogs = logs.filter((log) => {
    const term = searchQuery.toLowerCase();
    const actionMatch = log.action.toLowerCase().includes(term);
    const tableMatch = log.targetTable.toLowerCase().includes(term);
    const userMatch = log.user?.name.toLowerCase().includes(term) || log.user?.email.toLowerCase().includes(term);
    const detailsMatch = log.details?.toLowerCase().includes(term);

    return actionMatch || tableMatch || userMatch || detailsMatch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-bakery-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-bakery-cream dark:bg-bakery-dark">
              <ShieldCheck className="w-6 h-6 text-bakery-orange dark:text-bakery-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-bakery-foreground">Security & Audit Logs</h1>
              <p className="text-xs text-bakery-muted">Inspect system write events, stock overrides, and administrator commands.</p>
            </div>
          </div>

          <button
            onClick={fetchLogs}
            className="p-2 border border-bakery-border rounded-lg hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all cursor-pointer text-bakery-muted hover:text-bakery-orange"
            title="Reload logs"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="glass-panel p-4 rounded-xl flex items-center shadow-xs">
          <div className="relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search audit logs by action, table, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 rounded-lg border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all text-xs"
            />
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-bakery-card rounded-xl border border-bakery-border overflow-hidden shadow-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-8 h-8 text-bakery-orange animate-spin" />
              <p className="text-xs text-bakery-muted">Querying security database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20 text-bakery-muted">
              No audit logs matched your query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted uppercase">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Action Type</th>
                    <th className="p-3">Table Affected</th>
                    <th className="p-3">Log Details</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-bakery-background/50 dark:hover:bg-amber-950/5 transition-colors">
                      <td className="p-3 text-bakery-muted">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-bold">{log.user?.name || "System Automated"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${
                          log.action.includes("DELETE") || log.action.includes("FAILED")
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:bg-rose-950/30"
                            : log.action.includes("CREATE") || log.action.includes("RESTORE")
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30"
                            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-bakery-muted-foreground dark:text-bakery-muted">{log.targetTable}</td>
                      <td className="p-3 max-w-[280px] truncate text-bakery-muted dark:text-bakery-muted" title={log.details || ""}>
                        {log.details || "No comments"}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 rounded-lg border border-bakery-border hover:bg-bakery-cream hover:text-bakery-orange transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-bakery-card border border-bakery-border rounded-2xl max-w-lg w-full shadow-2xl p-6 relative text-black dark:text-white flex flex-col max-h-[85vh]">
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 p-1 rounded-full bg-bakery-background dark:bg-gray-800 text-bakery-muted hover:text-bakery-foreground transition-all cursor-pointer"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold border-b border-bakery-border pb-3 mb-4">
              Audit Event details
            </h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-mono">
              <div className="grid grid-cols-3 gap-2 border-b border-bakery-border pb-3">
                <span className="font-bold text-bakery-muted">Timestamp:</span>
                <span className="col-span-2">{new Date(selectedLog.createdAt).toLocaleString()}</span>

                <span className="font-bold text-bakery-muted">Action Type:</span>
                <span className="col-span-2 font-bold text-bakery-orange dark:text-bakery-orange">{selectedLog.action}</span>

                <span className="font-bold text-bakery-muted">Performed By:</span>
                <span className="col-span-2">{selectedLog.user ? `${selectedLog.user.name} (${selectedLog.user.email})` : "System"}</span>

                <span className="font-bold text-bakery-muted">Target Table:</span>
                <span className="col-span-2">{selectedLog.targetTable}</span>

                {selectedLog.targetId && (
                  <>
                    <span className="font-bold text-bakery-muted">Target ID:</span>
                    <span className="col-span-2 truncate">{selectedLog.targetId}</span>
                  </>
                )}
              </div>

              <div>
                <span className="block font-bold text-bakery-muted mb-2">Raw payload details:</span>
                <pre className="p-3 bg-bakery-background border border-bakery-border rounded-lg overflow-x-auto text-[10px] whitespace-pre-wrap">
                  {selectedLog.details && selectedLog.details.startsWith("{") 
                    ? JSON.stringify(JSON.parse(selectedLog.details), null, 2) 
                    : selectedLog.details || "No further details logged."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
