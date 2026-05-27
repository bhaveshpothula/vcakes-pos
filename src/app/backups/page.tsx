"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { useApp } from "@/context/AppContext";
import { 
  Database, ShieldAlert, Plus, Download, RotateCcw, 
  Trash2, UserPlus, Users, Loader2, KeyRound, Save, AlertTriangle
} from "lucide-react";

interface Backup {
  id: string;
  fileName: string;
  backupType: string;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function BackupsPage() {
  const { user } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"backups" | "staff">("backups");
  const [backups, setBackups] = useState<Backup[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Creating Backup/Restore Loading States
  const [actionLoading, setActionLoading] = useState(false);

  // Staff Form States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [backupsRes, staffRes] = await Promise.all([
        fetch("/api/backup"),
        fetch("/api/users")
      ]);

      if (backupsRes.ok && staffRes.ok) {
        const backupsData = await backupsRes.json();
        const staffData = await staffRes.json();

        setBackups(backupsData.backups);
        setStaff(staffData.users);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to load administration data.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL search actions (e.g. ?action=add-staff or ?action=backup)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      if (action === "add-staff") {
        setActiveTab("staff");
        setStaffName("");
        setStaffEmail("");
        setStaffPassword("");
        setShowStaffModal(true);
        // Clear params to avoid modal popping open again
        const newUrl = window.location.pathname + "?tab=staff" + (window.location.hash || "");
        window.history.replaceState({}, "", newUrl);
      } else if (action === "backup") {
        setActiveTab("backups");
        handleCreateBackup();
        // Clear params
        const newUrl = window.location.pathname + (window.location.hash || "");
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [loadData]);

  // Create database backup
  const handleCreateBackup = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast("Database backup successfully created.", "success");
        loadData();
      } else {
        showToast(data.error || "Failed to create backup.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Restore database from backup ID
  const handleRestoreBackup = async (backup: Backup) => {
    const confirmation = confirm(
      `CRITICAL WARNING:\n\n` +
      `You are about to restore the database to backup: "${backup.fileName}"\n` +
      `Restoring will COMPLETELY OVERWRITE all current sales transactions, products, stock levels, categories, and accounts with the backed-up state.\n\n` +
      `Any sales registered after this backup was created will be PERMANENTLY LOST.\n\n` +
      `Are you absolutely sure you want to proceed?`
    );

    if (!confirmation) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: backup.id }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Database restored successfully!", "success");
        // Reload page to force session check since users could have been modified/restored
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showToast(data.error || "Failed to restore database.", "error");
        setActionLoading(false);
      }
    } catch (e) {
      showToast("Network error during restoration.", "error");
      setActionLoading(false);
    }
  };

  // Create Staff Account
  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffPassword) {
      showToast("All fields are required.", "error");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/auth/register-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          password: staffPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Staff account successfully created.", "success");
        setShowStaffModal(false);
        setStaffName("");
        setStaffEmail("");
        setStaffPassword("");
        loadData();
      } else {
        showToast(data.error || "Failed to create staff account.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Staff Active/Inactive status
  const toggleStaffStatus = async (staffUser: User) => {
    // Prevent self-deactivation
    if (staffUser.id === user?.id) {
      showToast("You cannot deactivate your own active session account.", "error");
      return;
    }

    try {
      // We can create a simple user patch endpoint or write logic. Let's make sure we write an API endpoint or handle it.
      // Wait, let's write user toggle endpoint or support it.
      // E.g., we can let admins deactivate by hitting `/api/users/[id]` with PUT. Let's check:
      // We can write `src/app/api/users/[id]/route.ts` next to handle user status changes and soft deletes!
      const res = await fetch(`/api/users/${staffUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !staffUser.isActive }),
      });

      if (res.ok) {
        showToast(`Staff account status updated successfully.`, "success");
        loadData();
      } else {
        showToast("Failed to update staff status.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Soft delete staff account
  const handleDeleteStaff = async (staffUser: User) => {
    if (staffUser.id === user?.id) {
      showToast("You cannot delete your own admin account.", "error");
      return;
    }

    if (!confirm(`Are you sure you want to soft-delete staff member: "${staffUser.name}"?`)) return;

    try {
      const res = await fetch(`/api/users/${staffUser.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Staff account soft-deleted.", "success");
        loadData();
      } else {
        showToast("Failed to delete staff account.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bakery-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-bakery-cream dark:bg-bakery-dark">
              <Database className="w-6 h-6 text-bakery-orange dark:text-bakery-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-bakery-foreground">System Settings & backups</h1>
              <p className="text-xs text-bakery-muted">Configure database backup recovery points.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreateBackup}
              disabled={actionLoading}
              className="px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-bakery-orange hover:bg-bakery-orange/95 transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> backing up...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create Manual Backup
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action blocker */}
        {actionLoading && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2.5 animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Database operation in progress... Please do not close or refresh this page.</span>
          </div>
        )}

        {/* Content Details */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-bakery-orange animate-spin" />
            <p className="text-sm text-bakery-muted">Loading configurations...</p>
          </div>
        ) : (
          <div className="bg-bakery-card rounded-xl border border-bakery-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted text-xs uppercase">
                    <th className="p-4">Backup File Name</th>
                    <th className="p-4">Date Created</th>
                    <th className="p-4 text-center">Type</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-bakery-muted">No database backups available. Generate a manual backup point.</td>
                    </tr>
                  ) : (
                    backups.map((bak) => (
                      <tr key={bak.id} className="hover:bg-bakery-background/50 dark:hover:bg-amber-950/5 transition-colors">
                        <td className="p-4 font-mono text-xs font-bold">{bak.fileName}</td>
                        <td className="p-4 text-xs text-bakery-muted">{new Date(bak.createdAt).toLocaleString()}</td>
                        <td className="p-4 text-center text-xs">
                          <span className="px-2 py-0.5 rounded-full border bg-bakery-background text-bakery-muted-foreground text-[10px] font-bold uppercase">
                            {bak.backupType}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${
                            bak.status === "SUCCESS"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-700"
                          }`}>
                            {bak.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Download link */}
                            <a
                              href={`/api/backup/${bak.id}`}
                              className="p-2 rounded-lg border border-bakery-border hover:bg-bakery-cream text-bakery-muted hover:text-bakery-foreground transition-colors cursor-pointer"
                              title="Download JSON Backup File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleRestoreBackup(bak)}
                              disabled={actionLoading || bak.status !== "SUCCESS"}
                              className="p-2 rounded-lg border border-transparent hover:border-emerald-200 hover:bg-emerald-50 text-emerald-600 disabled:opacity-40 transition-colors cursor-pointer"
                              title="Restore database to this state"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
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
