"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { useApp } from "@/context/AppContext";
import { 
  Package, Plus, Edit2, Trash2, RotateCcw, AlertTriangle, 
  Settings, Loader2, ListFilter, Tag, Eye, EyeOff, Save
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  isDeleted: boolean;
}

interface Item {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  categoryId: string;
  isActive: boolean;
  isDeleted: boolean;
  category: { name: string };
}

export default function InventoryPage() {
  const { user } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"items" | "categories" | "deleted">("items");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletedItems, setDeletedItems] = useState<Item[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Form Modal States
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);

  // Item Form Fields
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemStock, setItemStock] = useState("");
  const [itemThreshold, setItemThreshold] = useState("10");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemIsActive, setItemIsActive] = useState(true);

  // Category Form Fields
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  // Stock Adjust Form Fields
  const [selectedStockItem, setSelectedStockItem] = useState<Item | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [stockNotes, setStockNotes] = useState("");

  // Load Inventory Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [catsRes, itemsRes, delItemsRes, delCatsRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/items"),
        fetch("/api/items?deletedOnly=true"),
        fetch("/api/categories?deletedOnly=true")
      ]);

      if (catsRes.ok && itemsRes.ok && delItemsRes.ok && delCatsRes.ok) {
        const catsData = await catsRes.json();
        const itemsData = await itemsRes.json();
        const delItemsData = await delItemsRes.json();
        const delCatsData = await delCatsRes.json();

        setCategories(catsData.categories);
        setItems(itemsData.items);
        setDeletedItems(delItemsData.items);
        setDeletedCategories(delCatsData.categories);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to load inventory data.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle URL search actions (e.g. ?action=add-item)
  useEffect(() => {
    if (typeof window !== "undefined" && categories.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      if (action === "add-item") {
        setItemId(null);
        setItemName("");
        setItemStock("");
        setItemThreshold("10");
        setItemCategoryId(categories[0]?.id || "");
        setItemIsActive(true);
        setShowItemModal(true);
        // Clear params to avoid modal popping open again
        const newUrl = window.location.pathname + (window.location.hash || "");
        window.history.replaceState({}, "", newUrl);
      } else if (action === "add-category") {
        setActiveTab("categories");
        setCategoryId(null);
        setCategoryName("");
        setShowCategoryModal(true);
        // Clear params
        const newUrl = window.location.pathname + "?tab=categories" + (window.location.hash || "");
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [categories]);

  // Open Add Item Modal
  const openAddItem = () => {
    setItemId(null);
    setItemName("");
    setItemStock("");
    setItemThreshold("10");
    setItemCategoryId(categories[0]?.id || "");
    setItemIsActive(true);
    setShowItemModal(true);
  };

  // Open Edit Item Modal
  const openEditItem = (item: Item) => {
    setItemId(item.id);
    setItemName(item.name);
    setItemStock(item.stock.toString());
    setItemThreshold(item.lowStockThreshold.toString());
    setItemCategoryId(item.categoryId);
    setItemIsActive(item.isActive);
    setShowItemModal(true);
  };

  // Save Item (Create or Edit)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemCategoryId) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    const payload = {
      name: itemName,
      stock: parseInt(itemStock || "0"),
      lowStockThreshold: parseInt(itemThreshold || "10"),
      categoryId: itemCategoryId,
      isActive: itemIsActive,
    };

    try {
      const url = itemId ? `/api/items/${itemId}` : "/api/items";
      const method = itemId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(itemId ? "Item updated successfully." : "Item created successfully.", "success");
        setShowItemModal(false);
        loadData();
      } else {
        showToast(data.error || "Failed to save item.", "error");
      }
    } catch (err) {
      showToast("Network error. Failed to save item.", "error");
    }
  };

  // Toggle Item Active Status (Quick status switch)
  const toggleItemActive = async (item: Item) => {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        showToast(`Item ${!item.isActive ? "enabled" : "disabled"} successfully.`, "success");
        loadData();
      } else {
        showToast("Failed to toggle item status.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Soft Delete Item
  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to soft-delete this item? It can be restored later from the deleted log.")) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Item soft-deleted successfully.", "success");
        loadData();
      } else {
        showToast("Failed to delete item.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Restore Deleted Item
  const handleRestoreItem = async (item: Item) => {
    try {
      // Restore by calling the POST endpoint with category and name which triggers auto-restore
      const restoreRes = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          stock: item.stock,
          lowStockThreshold: item.lowStockThreshold,
          categoryId: item.categoryId,
        }),
      });

      if (restoreRes.ok) {
        showToast("Item restored successfully.", "success");
        loadData();
      } else {
        const errData = await restoreRes.json();
        showToast(errData.error || "Failed to restore item.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Open Save Category Modal
  const openAddCategory = () => {
    setCategoryId(null);
    setCategoryName("");
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setCategoryId(cat.id);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) {
      showToast("Please enter a category name.", "error");
      return;
    }

    try {
      const url = categoryId ? `/api/categories/${categoryId}` : "/api/categories";
      const method = categoryId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(categoryId ? "Category updated." : "Category created.", "success");
        setShowCategoryModal(false);
        loadData();
      } else {
        showToast(data.error || "Failed to save category.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Soft Delete Category
  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Warning: Deleting this category will soft-delete all items inside it! Are you sure?")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Category and all its items soft-deleted.", "success");
        loadData();
      } else {
        showToast("Failed to delete category.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Restore Category
  const handleRestoreCategory = async (cat: Category) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cat.name }),
      });
      if (res.ok) {
        showToast("Category restored successfully.", "success");
        loadData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to restore category.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Open Stock Modal
  const openAdjustStock = (item: Item) => {
    setSelectedStockItem(item);
    setStockAdjustment("");
    setStockNotes("");
    setShowStockModal(true);
  };

  // Save Stock Adjustment
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItem || !stockAdjustment) return;

    const adjustmentValue = parseInt(stockAdjustment);
    if (isNaN(adjustmentValue) || adjustmentValue === 0) {
      showToast("Please enter a valid non-zero adjustment amount.", "error");
      return;
    }

    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedStockItem.id,
          changeQty: adjustmentValue,
          notes: stockNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Inventory stock updated successfully.", "success");
        setShowStockModal(false);
        loadData();
      } else {
        showToast(data.error || "Failed to update stock.", "error");
      }
    } catch (err) {
      showToast("Network error.", "error");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-bakery-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-bakery-cream dark:bg-bakery-dark">
              <Package className="w-6 h-6 text-bakery-orange dark:text-bakery-orange" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-bakery-foreground">Inventory Control Panel</h1>
              <p className="text-xs text-bakery-muted">Manage categories, items, stock levels, and soft delete recovery.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={openAddCategory}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-bakery-orange text-bakery-orange hover:bg-bakery-orange/10 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" /> Add Category
            </button>
            <button
              onClick={openAddItem}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-bakery-orange to-bakery-orange-dark transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
<button
  onClick={() => window.location.href = "/inventory-history"}
  className="px-4 py-2 rounded-lg text-xs font-semibold border border-bakery-border hover:bg-bakery-cream transition-all"
>
  Inventory History
</button>
          </div>
        </div>
<div className="mb-4">
  <input
    type="text"
    placeholder="🔍 Search item..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full p-3 border border-bakery-border rounded-lg"
  />
</div>

        {/* Tab Selection */}
        <div className="flex border-b border-bakery-border gap-6">
          <button
            onClick={() => setActiveTab("items")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "items"
                ? "border-bakery-orange text-bakery-orange dark:border-bakery-orange dark:text-bakery-orange"
                : "border-transparent text-bakery-muted hover:text-bakery-foreground"
            }`}
          >
            All Products ({items.length})
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "categories"
                ? "border-bakery-orange text-bakery-orange dark:border-bakery-orange dark:text-bakery-orange"
                : "border-transparent text-bakery-muted hover:text-bakery-foreground"
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab("deleted")}
            className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "deleted"
                ? "border-bakery-orange text-bakery-orange dark:border-bakery-orange dark:text-bakery-orange"
                : "border-transparent text-bakery-muted hover:text-bakery-foreground"
            }`}
          >
            Deleted Items ({deletedItems.length})
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-bakery-orange animate-spin" />
            <p className="text-sm text-bakery-muted">Loading details...</p>
          </div>
        ) : (
          <div className="bg-bakery-card rounded-xl border border-bakery-border overflow-hidden shadow-xs">
            
            {/* 1. Items Management Tab */}
            {activeTab === "items" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted text-xs uppercase">
                      <th className="p-4">Item Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4 text-center">Stock Level</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-bakery-muted">No items available. Add some products!</td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {                    
                        const isLowStock = item.stock <= item.lowStockThreshold;
                        return (
                          <tr key={item.id} className="hover:bg-bakery-background/50 dark:hover:bg-amber-950/5 transition-colors">
                            <td className="p-4 font-bold">{item.name}</td>
                            <td className="p-4 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-bakery-orange dark:text-bakery-orange border border-bakery-orange/10 inline-block mt-3">
                              {item.category.name}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className={`font-bold ${isLowStock ? "text-rose-600 dark:text-rose-400 font-extrabold" : ""}`}>
                                  {item.stock}
                                </span>
                                {isLowStock && (
                                  <span title="Low stock warning!">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                                  </span>
                                )}

                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => toggleItemActive(item)}
                                className={`px-2 py-1 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                                  item.isActive
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30"
                                    : "bg-bakery-background border-bakery-border text-bakery-muted"
                                }`}
                                title="Click to toggle active status"
                              >
                                {item.isActive ? "Active" : "Disabled"}
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => openAdjustStock(item)}
                                  className="p-2 rounded-lg border border-bakery-border hover:bg-bakery-cream dark:hover:bg-bakery-dark text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Stock +/-
                                </button>
                                <button
                                  onClick={() => openEditItem(item)}
                                  className="p-2 rounded-lg border border-bakery-border hover:bg-bakery-cream text-bakery-muted hover:text-bakery-foreground transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-2 rounded-lg border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-colors cursor-pointer"
                                  title="Soft Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Categories Management Tab */}
            {activeTab === "categories" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-bakery-cream/40 dark:bg-bakery-dark/40 border-b border-bakery-border font-bold text-bakery-muted text-xs uppercase">
                      <th className="p-4">Category Name</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-bakery-muted">No categories found. Create one.</td>
                      </tr>
                    ) : (
                      categories.map((cat) => (
                        <tr key={cat.id} className="hover:bg-bakery-background/50 dark:hover:bg-amber-950/5 transition-colors">
                          <td className="p-4 font-bold text-base">{cat.name}</td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEditCategory(cat)}
                                className="p-2 rounded-lg border border-bakery-border hover:bg-bakery-cream text-bakery-muted hover:text-bakery-foreground transition-all cursor-pointer"
                                title="Rename"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-2 rounded-lg border border-transparent hover:border-rose-500/20 hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer"
                                title="Soft Delete Category"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Deleted Items/Categories Recovery Tab */}
            {activeTab === "deleted" && (
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="font-bold text-sm text-rose-600 mb-3 uppercase tracking-wider">Soft-Deleted Items</h3>
                  <div className="overflow-x-auto border border-bakery-border rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-red-50/40 dark:bg-rose-950/10 border-b border-bakery-border font-bold text-bakery-muted uppercase">
                          <th className="p-3">Item Name</th>
                          <th className="p-3">Category</th>
                          <th className="p-3 text-center">Last Stock</th>
                          <th className="p-3 text-right">Restore Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {deletedItems.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-bakery-muted">No deleted items to restore.</td>
                          </tr>
                        ) : (
                          deletedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-bakery-background/50">
                              <td className="p-3 font-bold text-bakery-muted line-through">{item.name}</td>
                              <td className="p-3 text-bakery-muted">{item.category?.name || "N/A"}</td>
                              <td className="p-3 text-center text-bakery-muted">{item.stock}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleRestoreItem(item)}
                                  className="px-3 py-1.5 rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border-t border-bakery-border pt-6">
                  <h3 className="font-bold text-sm text-rose-600 mb-3 uppercase tracking-wider">Soft-Deleted Categories</h3>
                  <div className="overflow-x-auto border border-bakery-border rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-red-50/40 dark:bg-rose-950/10 border-b border-bakery-border font-bold text-bakery-muted uppercase">
                          <th className="p-3">Category Name</th>
                          <th className="p-3 text-right">Restore Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {deletedCategories.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="p-6 text-center text-bakery-muted">No deleted categories to restore.</td>
                          </tr>
                        ) : (
                          deletedCategories.map((cat) => (
                            <tr key={cat.id} className="hover:bg-bakery-background/50">
                              <td className="p-3 font-bold text-bakery-muted line-through">{cat.name}</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleRestoreCategory(cat)}
                                  className="px-3 py-1.5 rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Add/Edit Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-bakery-card border border-bakery-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h2 className="text-lg font-bold border-b border-bakery-border pb-3 mb-4">
              {itemId ? "Edit Bakery Product" : "Add New Bakery Product"}
            </h2>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Pineapple Cake"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Category *</label>
                <select
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Initial Stock</label>
                  <input
                    type="number"
                    placeholder="30"
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
                    disabled={!!itemId} // Stock changes should go through manual adjustment path to keep audit logs
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Low Stock Warning</label>
                  <input
                    type="number"
                    placeholder="10"
                    value={itemThreshold}
                    onChange={(e) => setItemThreshold(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="itemIsActive"
                  checked={itemIsActive}
                  onChange={(e) => setItemIsActive(e.target.checked)}
                  className="rounded border-bakery-border text-bakery-orange focus:ring-bakery-orange"
                />
                <label htmlFor="itemIsActive" className="text-xs font-bold text-bakery-muted-foreground dark:text-bakery-muted">
                  Item is active and available for billing
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-bakery-border">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-bakery-background hover:bg-bakery-background/80 text-bakery-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-bakery-orange hover:bg-bakery-orange/90 cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add/Edit Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-bakery-card border border-bakery-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h2 className="text-lg font-bold border-b border-bakery-border pb-3 mb-4">
              {categoryId ? "Rename Category" : "Add New Category"}
            </h2>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Cakes"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-bakery-border">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-bakery-background hover:bg-bakery-background/80 text-bakery-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-bakery-orange hover:bg-bakery-orange/90 cursor-pointer flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" /> Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Manual Stock Update Modal */}
      {showStockModal && selectedStockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-bakery-card border border-bakery-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative">
            <h2 className="text-lg font-bold border-b border-bakery-border pb-3 mb-2">
              Adjust Inventory Stock
            </h2>
            <p className="text-xs text-bakery-muted mb-4">
              Adjusting stock for: <strong>{selectedStockItem.name}</strong>. Current level: <strong>{selectedStockItem.stock}</strong>.
            </p>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">
                  Adjustment Amount (Use negative numbers to decrement) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="E.g. 15 or -5"
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Adjustment Reason / Notes *</label>
                <textarea
                  required
                  placeholder="E.g. Received new bakery delivery batch"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  className="w-full h-20 p-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-orange text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-bakery-border">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-bakery-background hover:bg-bakery-background/80 text-bakery-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-bakery-orange hover:bg-bakery-orange/90 cursor-pointer flex items-center gap-1"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
