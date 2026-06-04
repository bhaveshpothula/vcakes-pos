"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { 
  History, Search, Loader2, ArrowLeft, Calendar, User, XCircle, ChevronDown 
} from "lucide-react";

interface Log {
  id: string;
  itemId: string;
  changeQty: number;
  previousQty: number;
  currentQty: number;
  type: string;
  notes: string | null;
  createdAt: string;
  userName: string | null;
  item: {
    name: string;
    category?: {
      name: string;
    };
  };
  user?: {
    name: string;
  } | null;
}

export default function InventoryHistoryPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<Log[]>([]);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set("search", search);
      if (selectedUser) queryParams.set("user", selectedUser);
      if (selectedDate) queryParams.set("date", selectedDate);

      const res = await fetch(`/api/inventory-history?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        if (data.users) {
          setAvailableUsers(data.users);
        }
      } else {
        showToast("Failed to retrieve inventory logs.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to load logs.", "error");
    } finally {
      setLoading(false);
    }
  }, [search, selectedUser, selectedDate, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset Filters
  const handleClearFilters = () => {
    setSearch("");
    setSelectedUser("");
    setSelectedDate("");
  };

  // Helper to format date like "12 Jun 2026 - 10:42:15 AM"
  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const seconds = d.getSeconds().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${day} ${month} ${year} - ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background text-bakery-foreground">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-bakery-border pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => (window.location.href = "/inventory")}
              className="p-2 border border-bakery-border rounded-lg hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all cursor-pointer text-bakery-muted hover:text-bakery-orange"
              title="Back to Inventory"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2 rounded-lg bg-bakery-cream dark:bg-bakery-dark">
              <History className="w-6 h-6 text-bakery-orange dark:text-bakery-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-bakery-foreground">Inventory Log History</h1>
              <p className="text-xs text-bakery-muted">Track and filter all inventory updates, user actions, and timestamps.</p>
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="bg-bakery-card p-4 rounded-xl border border-bakery-border shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bakery-muted" />
              <input
                type="text"
                placeholder="Search by item name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
              />
            </div>

            {/* User Select */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bakery-muted" />
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange appearance-none"
              >
                <option value="">All Users</option>
                {availableUsers.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bakery-muted pointer-events-none" />
            </div>

            {/* Date Input */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bakery-muted" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={fetchLogs}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-bakery-orange hover:bg-bakery-orange/90 rounded-lg transition-all cursor-pointer text-center"
              >
                Apply Filters
              </button>
              {(search || selectedUser || selectedDate) && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 border border-bakery-border hover:bg-bakery-cream dark:hover:bg-bakery-dark rounded-lg transition-all cursor-pointer text-rose-500"
                  title="Clear Filters"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-bakery-orange animate-spin" />
            <p className="text-sm text-bakery-muted">Retrieving inventory history logs...</p>
          </div>
        ) : (
          <div className="bg-bakery-card rounded-xl border border-bakery-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted text-xs uppercase">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Item Name</th>
                    <th className="p-4 text-center">Change</th>
                    <th className="p-4 text-center">Previous</th>
                    <th className="p-4 text-center">Current</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bakery-border">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-bakery-muted">
                        No inventory log history found.
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-bakery-background/40 transition-colors">
                        <td className="p-4 font-mono text-xs whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                        <td className="p-4 font-bold">{log.item?.name || "Deleted Product"}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            log.changeQty > 0 
                              ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 border border-emerald-500/10" 
                              : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-500/10"
                          }`}>
                            {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty}
                          </span>
                        </td>
                        <td className="p-4 text-center text-bakery-muted-foreground">{log.previousQty}</td>
                        <td className="p-4 text-center font-bold text-bakery-muted-foreground">{log.currentQty}</td>
                        <td className="p-4 font-semibold text-xs text-bakery-orange">
                          {log.userName || log.user?.name || "System / Auto"}
                        </td>
                        <td className="p-4 text-xs text-bakery-muted-foreground italic max-w-xs truncate" title={log.notes || ""}>
                          {log.notes || "No notes"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
