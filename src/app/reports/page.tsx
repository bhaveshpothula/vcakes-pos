"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { 
  BarChart3, Calendar, Search, Download, Trash2,
  ChevronLeft, ChevronRight, Eye, RefreshCw, Loader2
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface SaleItem {
  id: string;
  itemName: string;
  price: number;
  quantity: number;
  totalAmount: number;
}

interface Payment {
  id: string;
  method: string;
  amount: number;
  referenceNo: string | null;
}

interface Sale {
  id: string;
  transactionId: string;
  totalAmount: number;
  notes: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  staff: { name: string; email: string };
  saleItems: SaleItem[];
  payments: Payment[];
}

interface StaffMember {
  id: string;
  name: string;
}

export default function ReportsPage() {
  const { user } = useApp();
  const { showToast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 15;

  // Selected Sale Details Modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Cancellation State
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);

  // Load Staff Members (for filters)
  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/register-staff"); // Wait, we can fetch from an endpoint or make a general staff listing endpoint.
      // Let's create an endpoint to fetch users, or we can fetch them via a general dashboard query.
      // Wait, let's see: we can fetch users by writing a quick API at `/api/users/route.ts` (Admin only) or fetch them here if we write it. Let's make sure the staff dropdown is populated.
      // Let's query `/api/users` (we'll write this API route next, it's very useful for managing staff accounts too!).
      const resUsers = await fetch("/api/users");
      if (resUsers.ok) {
        const data = await resUsers.json();
        setStaffList(data.users.map((u: any) => ({ id: u.id, name: u.name })));
      }
    } catch (e) {
      console.warn("Failed to load staff list in filters:", e);
    }
  }, []);

  // Fetch Sales Logs
  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      let query = `/api/sales?page=${currentPage}&limit=${limit}`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      if (selectedStaff) query += `&staffId=${selectedStaff}`;

      const res = await fetch(query);
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
      } else {
        showToast("Failed to fetch transaction history.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error.", "error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, startDate, endDate, selectedStaff, showToast]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Handle transaction soft deletion (Cancellation)
  const handleCancelSale = async (id: string) => {
    if (!id) return;
    try {
      setDeletingSaleId(id);
      
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      
      if (res.ok) {
        showToast("Sale cancelled. Items stock restored successfully.", "success");
        // Instantly update local UI state without page reload
        setSales((prev) => prev.filter((sale) => sale.id !== id));
        setTotalCount((prev) => Math.max(0, prev - 1));
        
        // Close modals
        if (selectedSale?.id === id) {
          setSelectedSale(null);
        }
        setSaleToDelete(null);
        
        // Refresh backend query
        fetchSales();
      } else {
        let errorMessage = "Failed to cancel sale.";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch (parseError) {
          errorMessage = `HTTP Error ${res.status}: Failed to cancel transaction.`;
        }
        showToast(errorMessage, "error");
      }
    } catch (e: any) {
      console.error("[Cancel Sale Error]:", e);
      showToast(`Network Error: ${e.message || "Failed to reach server. Please check your internet connection."}`, "error");
    } finally {
      setDeletingSaleId(null);
    }
  };

  // Export matching sales database to CSV
  const handleExportCSV = async () => {
    try {
      showToast("Generating CSV Export...", "info");
      // Fetch all matching records (ignoring pagination limit)
      let query = `/api/sales?page=1&limit=10000`;
      if (searchQuery) query += `&search=${encodeURIComponent(searchQuery)}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      if (selectedStaff) query += `&staffId=${selectedStaff}`;

      const res = await fetch(query);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      const allSales: Sale[] = data.sales;

      // Construct CSV content
      const headers = [
        "Date", 
        "Transaction ID", 
        "Billed By", 
        "Customer Name", 
        "Customer Phone", 
        "Total Amount", 
        "Payment Mode(s)", 
        "Payment Reference(s)", 
        "Items Billed", 
        "Notes"
      ];
      const rows = allSales.map((sale) => {
        const itemSummary = sale.saleItems.map((si) => `${si.itemName} (${si.quantity}x @ ₹${si.price.toFixed(2)})`).join("; ");
        const paymentMethods = sale.payments.map(p => p.method).join(" + ");
        const paymentRefs = sale.payments.map(p => p.referenceNo || "N/A").join("; ");
        return [
          new Date(sale.createdAt).toLocaleString(),
          sale.transactionId,
          sale.staff?.name || "N/A",
          `"${sale.customerName || "N/A"}"`,
          `"${sale.customerPhone || "N/A"}"`,
          `₹${sale.totalAmount.toFixed(2)}`,
          `"${paymentMethods}"`,
          `"${paymentRefs}"`,
          `"${itemSummary}"`,
          `"${sale.notes || ""}"`
        ];
      });

      const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `bakery_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast("CSV report downloaded successfully.", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to generate CSV export.", "error");
    }
  };

  // Calculate stats for current view
  const getViewRevenueTotal = () => sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const getAverageOrderValue = () => sales.length > 0 ? getViewRevenueTotal() / sales.length : 0;

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-bakery-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-bakery-cream dark:bg-bakery-dark">
              <BarChart3 className="w-6 h-6 text-bakery-orange dark:text-bakery-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-bakery-foreground">Sales Logs & Reports</h1>
              <p className="text-xs text-bakery-muted">Query invoice history, export spreadsheets, and cancel orders.</p>
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            disabled={sales.length === 0}
            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white bg-bakery-orange hover:bg-bakery-orange/95 transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
        </div>

        {/* Filters Panel */}
        <div className="glass-panel p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-xs">
          {/* Search Query */}
          <div>
            <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">Search ID or Item</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search transaction ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="block w-full pl-9 pr-3 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs placeholder-bakery-muted/50 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Date range start */}
          <div>
            <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="block w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs focus:outline-hidden"
            />
          </div>

          {/* Date range end */}
          <div>
            <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="block w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs focus:outline-hidden"
            />
          </div>

          {/* Billed Staff member */}
          <div>
            <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">Staff Member</label>
            <select
              value={selectedStaff}
              onChange={(e) => { setSelectedStaff(e.target.value); setCurrentPage(1); }}
              className="block w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs focus:outline-hidden"
            >
              <option value="">All Staff</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>{st.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Small metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-bakery-card p-4 rounded-xl border border-bakery-border text-center">
            <span className="text-[10px] font-bold text-bakery-muted uppercase">Filtered Volume</span>
            <h4 className="text-xl font-extrabold text-bakery-orange dark:text-bakery-orange mt-1">{formatCurrency(getViewRevenueTotal())}</h4>
          </div>
          <div className="bg-bakery-card p-4 rounded-xl border border-bakery-border text-center">
            <span className="text-[10px] font-bold text-bakery-muted uppercase">Sales Billed</span>
            <h4 className="text-xl font-extrabold mt-1">{totalCount} Sales</h4>
          </div>
          <div className="bg-bakery-card p-4 rounded-xl border border-bakery-border text-center">
            <span className="text-[10px] font-bold text-bakery-muted uppercase">Avg Order Value</span>
            <h4 className="text-xl font-extrabold text-bakery-orange dark:text-bakery-orange mt-1">{formatCurrency(getAverageOrderValue())}</h4>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-bakery-card rounded-xl border border-bakery-border overflow-hidden shadow-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-8 h-8 text-bakery-orange animate-spin" />
              <p className="text-xs text-bakery-muted">Querying transaction history...</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-20 text-bakery-muted">
              No transactions matched your filtering criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted uppercase">
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Transaction ID</th>
                    <th className="p-3">Billed By</th>
                    <th className="p-3 text-right">Items Count</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sales.map((sale) => {
                    const itemsCount = sale.saleItems.reduce((acc, it) => acc + it.quantity, 0);
                    return (
                      <tr key={sale.id} className="hover:bg-bakery-background/50 dark:hover:bg-amber-950/5 transition-colors">
                        <td className="p-3 text-bakery-muted">{new Date(sale.createdAt).toLocaleString()}</td>
                        <td className="p-3">
                          <span className="font-bold text-bakery-foreground block">{sale.transactionId}</span>
                          <span className="text-[10px] text-bakery-orange font-bold">
                            {sale.payments?.map(p => p.method).join(" + ") || "CASH"}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-bakery-muted-foreground dark:text-bakery-muted">{sale.staff?.name || "Staff"}</td>
                        <td className="p-3 text-right font-bold">{itemsCount}</td>
                        <td className="p-3 text-right font-extrabold text-bakery-orange dark:text-bakery-orange">{formatCurrency(sale.totalAmount)}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelectedSale(sale)}
                              className="p-1.5 rounded-lg border border-bakery-border hover:bg-bakery-cream text-bakery-muted hover:text-bakery-foreground transition-colors cursor-pointer"
                              title="View Invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              disabled={deletingSaleId !== null}
                              onClick={() => setSaleToDelete(sale)}
                              className="p-1.5 rounded-lg border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer disabled:opacity-40"
                              title="Cancel & Restore Stock"
                            >
                              {deletingSaleId === sale.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-bakery-border flex items-center justify-between bg-bakery-cream/10 dark:bg-bakery-dark/10">
              <span className="text-[10px] text-bakery-muted font-semibold">
                Page {currentPage} of {totalPages} ({totalCount} total entries)
              </span>

              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="p-1.5 rounded-lg border border-bakery-border disabled:opacity-40 transition-colors hover:bg-bakery-cream/20 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="p-1.5 rounded-lg border border-bakery-border disabled:opacity-40 transition-colors hover:bg-bakery-cream/20 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-bakery-card text-black p-6 rounded-2xl max-w-sm w-full shadow-2xl relative border border-bakery-border/50 flex flex-col font-mono text-xs max-h-[85vh]">
            <button
              onClick={() => setSelectedSale(null)}
              className="absolute top-4 right-4 p-1 rounded-full bg-bakery-background hover:bg-bakery-background/80 text-bakery-muted transition-all cursor-pointer"
            >
              ✕
            </button>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="text-center space-y-1 pb-4 border-b border-dashed border-bakery-border">
                <h2 className="text-lg font-bold">VCAKES</h2>
                <p className="text-[10px] text-bakery-muted">Luxury Boutique Bakery Cafe</p>
                <p className="text-[10px] text-bakery-muted">Transaction Invoice Log</p>
              </div>

              <div className="py-3 border-b border-dashed border-bakery-border space-y-1 text-[10px]">
                <p><strong>TXID:</strong> {selectedSale.transactionId}</p>
                <p><strong>Date:</strong> {new Date(selectedSale.createdAt).toLocaleString()}</p>
                <p><strong>Billed By:</strong> {selectedSale.staff?.name}</p>
                {selectedSale.customerName && <p><strong>Customer:</strong> {selectedSale.customerName} ({selectedSale.customerPhone || "N/A"})</p>}
                {selectedSale.notes && <p><strong>Notes:</strong> {selectedSale.notes}</p>}
              </div>

              <table className="w-full text-left py-3 border-b border-dashed border-bakery-border">
                <thead>
                  <tr className="text-[9px] text-bakery-muted border-b border-bakery-border/50">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSale.saleItems?.map((sItem) => (
                    <tr key={sItem.id} className="border-b border-bakery-border/30 text-[10px]">
                      <td className="py-1.5 font-semibold max-w-[120px] truncate">{sItem.itemName}</td>
                      <td className="py-1.5 text-center">{sItem.quantity}</td>
                      <td className="py-1.5 text-right">{formatCurrency(sItem.price)}</td>
                      <td className="py-1.5 text-right">{formatCurrency(sItem.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="py-3 text-right border-t border-dashed border-bakery-border pt-2 space-y-1">
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL AMOUNT:</span>
                  <span>{formatCurrency(selectedSale.totalAmount)}</span>
                </div>
                <div className="pt-2 text-[10px] text-left space-y-1">
                  <p className="font-bold border-b border-bakery-border/50 pb-0.5">Payment Details:</p>
                  {selectedSale.payments?.map((p) => (
                    <div key={p.id} className="flex justify-between text-[9px] text-bakery-muted-foreground">
                      <span>• {p.method} {p.referenceNo ? `(Ref: ${p.referenceNo})` : ""}</span>
                      <span className="font-semibold">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center pt-4 border-t border-dashed border-bakery-border text-[9px] text-bakery-muted">
                <p>Secure Backup Logged</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-xl text-white font-bold bg-bakery-orange hover:bg-bakery-orange/95 transition-all cursor-pointer text-center"
              >
                Print Receipt
              </button>
              <button
                disabled={deletingSaleId !== null}
                onClick={() => setSaleToDelete(selectedSale)}
                className="flex-1 py-3 px-4 rounded-xl text-rose-500 hover:text-rose-700 bg-rose-500/10 hover:bg-rose-100 font-bold border border-rose-500/20 transition-all cursor-pointer text-center disabled:opacity-50 text-xs font-sans"
              >
                Cancel Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-bakery-card text-bakery-foreground p-6 rounded-2xl max-w-sm w-full shadow-2xl relative border border-bakery-orange/30 flex flex-col space-y-4">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/100/10 flex items-center justify-center border border-rose-500/20 text-rose-500 animate-pulse">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-extrabold text-bakery-foreground">Confirm Cancellation</h2>
              <p className="text-xs text-bakery-muted font-sans">
                Are you sure you want to delete this sale?
              </p>
              <div className="bg-bakery-background p-3 rounded-lg text-left text-xs border border-bakery-orange/15 font-mono space-y-1">
                <p><span className="text-bakery-muted">ID:</span> <span className="font-bold text-bakery-foreground">{saleToDelete.transactionId}</span></p>
                <p><span className="text-bakery-muted">Total:</span> <span className="font-extrabold text-bakery-orange dark:text-bakery-orange">{formatCurrency(saleToDelete.totalAmount)}</span></p>
                {saleToDelete.customerName && <p><span className="text-bakery-muted">Customer:</span> <span className="text-bakery-muted-foreground">{saleToDelete.customerName}</span></p>}
              </div>
              <p className="text-[10px] text-amber-500 font-sans leading-relaxed">
                * All items in this transaction will be automatically restored back to inventory stock.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={deletingSaleId !== null}
                onClick={() => setSaleToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl text-bakery-foreground bg-bakery-background hover:bg-black border border-bakery-orange/20 hover:border-bakery-orange/50 font-bold transition-all cursor-pointer text-center text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingSaleId !== null}
                onClick={() => handleCancelSale(saleToDelete.id)}
                className="flex-1 py-2.5 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-[#F47A1F] to-[#e66a12] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer text-center text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#F47A1F]/15"
              >
                {deletingSaleId !== null ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
