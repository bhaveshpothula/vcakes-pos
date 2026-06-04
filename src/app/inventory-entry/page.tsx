"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { 
  ClipboardList, Search, Loader2, Save, ArrowLeft, PlusCircle 
} from "lucide-react";

interface Item {
  id: string;
  name: string;
  stock: number;
  category: { name: string };
}

interface UpdateRow {
  itemId: string;
  name: string;
  categoryName: string;
  currentStock: number;
  changeQty: string;
  notes: string;
}

export default function BulkInventoryEntryPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [rows, setRows] = useState<UpdateRow[]>([]);

  // Load items
  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        const res = await fetch("/api/items");
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          
          // Initialize rows
          const initialRows = data.items.map((item: Item) => ({
            itemId: item.id,
            name: item.name,
            categoryName: item.category?.name || "Uncategorized",
            currentStock: item.stock,
            changeQty: "",
            notes: "",
          }));
          setRows(initialRows);
        } else {
          showToast("Failed to fetch inventory items.", "error");
        }
      } catch (err) {
        showToast("Network error. Failed to load items.", "error");
      } finally {
        setLoading(false);
      }
    }
    loadItems();
  }, [showToast]);

  // Handle change in input quantity
  const handleQtyChange = (itemId: string, value: string) => {
    setRows(prev =>
      prev.map(row => (row.itemId === itemId ? { ...row, changeQty: value } : row))
    );
  };

  // Handle change in input notes
  const handleNotesChange = (itemId: string, value: string) => {
    setRows(prev =>
      prev.map(row => (row.itemId === itemId ? { ...row, notes: value } : row))
    );
  };

  // Submit bulk logs
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter to only those with input values
    const updatesToSubmit = rows.filter(
      row => row.changeQty.trim() !== ""
    );

    if (updatesToSubmit.length === 0) {
      showToast("Please enter a replenishment quantity for at least one item.", "error");
      return;
    }

    // Client-side validation
    for (const update of updatesToSubmit) {
      const parsedQty = parseInt(update.changeQty);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        showToast(`Invalid quantity "${update.changeQty}" for ${update.name}. Quantities must be positive integers.`, "error");
        return;
      }
    }

    try {
      setSaving(true);
      const res = await fetch("/api/stock/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: updatesToSubmit.map(u => ({
            itemId: u.itemId,
            changeQty: parseInt(u.changeQty),
            notes: u.notes.trim() || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Successfully logged stock for ${data.count} items.`, "success");
        // Clear inputs
        setRows(prev => prev.map(row => ({ ...row, changeQty: "", notes: "" })));
        // Redirect back to inventory control panel
        window.location.href = "/inventory";
      } else {
        showToast(data.error || "Failed to submit bulk stock updates.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to submit bulk stock updates.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Filter rows based on search term
  const filteredRows = rows.filter(
    row =>
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <ClipboardList className="w-6 h-6 text-bakery-orange dark:text-bakery-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-bakery-foreground">Bulk Inventory Log Entry</h1>
              <p className="text-xs text-bakery-muted">Fast replenishment logs for multi-product arrivals.</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-bakery-card p-4 rounded-xl border border-bakery-border shadow-xs">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bakery-muted" />
            <input
              type="text"
              placeholder="Search items by name or category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-bakery-orange animate-spin" />
            <p className="text-sm text-bakery-muted">Loading product catalog...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-bakery-card rounded-xl border border-bakery-border overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted text-xs uppercase">
                      <th className="p-4 w-1/3">Item Name</th>
                      <th className="p-4 w-1/6">Category</th>
                      <th className="p-4 w-1/6 text-center">Current Stock</th>
                      <th className="p-4 w-1/6">Qty Received (+)</th>
                      <th className="p-4 w-1/6">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bakery-border">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-bakery-muted">
                          No items match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map(row => (
                        <tr key={row.itemId} className="hover:bg-bakery-background/40 transition-colors">
                          <td className="p-4 font-bold">{row.name}</td>
                          <td className="p-4">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-bakery-cream dark:bg-bakery-dark text-bakery-orange border border-bakery-orange/10">
                              {row.categoryName}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-bakery-muted-foreground">{row.currentStock}</td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 20"
                              value={row.changeQty}
                              onChange={e => handleQtyChange(row.itemId, e.target.value)}
                              className="w-28 px-3 py-1.5 text-sm font-bold rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange text-bakery-orange"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              placeholder="Optional batch note..."
                              value={row.notes}
                              onChange={e => handleNotesChange(row.itemId, e.target.value)}
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Footer Action */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => (window.location.href = "/inventory")}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-bakery-card border border-bakery-border hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all cursor-pointer text-bakery-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-bakery-orange to-bakery-orange-dark hover:from-bakery-orange/95 hover:to-bakery-orange-dark/95 transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting Bulk Log...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Submit Bulk Log
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
