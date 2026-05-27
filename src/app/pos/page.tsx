"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useApp } from "@/context/AppContext";
import { useToast } from "@/components/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Minus, Trash2, ShoppingCart, Receipt, 
  Sparkles, Keyboard, Loader2, Wifi, WifiOff, FileText, X
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  categoryId: string;
  isActive: boolean;
  category: { name: string };
}

interface CartItem {
  cartLineId: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  note?: string;
}

export default function POSPage() {
  const { user, loading: sessionLoading, isOnline } = useApp();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // 1.5s fallback redirect to login if sessionLoading hangs and user is missing
    const fallbackTimer = setTimeout(() => {
      if (!user) {
        router.replace("/login");
      }
    }, 1500);

    if (!sessionLoading && !user) {
      clearTimeout(fallbackTimer);
      const timer = setTimeout(() => {
        router.replace("/login");
      }, 100);
      return () => clearTimeout(timer);
    }

    return () => clearTimeout(fallbackTimer);
  }, [user, sessionLoading, router]);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modal configuration states
  const [selectedItemForModal, setSelectedItemForModal] = useState<Item | null>(null);
  const [modalPrice, setModalPrice] = useState("");
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalNote, setModalNote] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Advanced Payment Checkout states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD" | "SPLIT">("CASH");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [upiReference, setUpiReference] = useState("");
  const [cardReference, setCardReference] = useState("");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitUpiAmount, setSplitUpiAmount] = useState("");
  const [splitCardAmount, setSplitCardAmount] = useState("");
  const [splitUpiReference, setSplitUpiReference] = useState("");
  const [splitCardReference, setSplitCardReference] = useState("");
  const [orderStatus, setOrderStatus] = useState<"PAID" | "PENDING">("PAID");

  // Completed receipt state
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Recent/Pending Orders States
  const [showRecentOrders, setShowRecentOrders] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loadingRecentSales, setLoadingRecentSales] = useState(false);
  const [recentSalesSearch, setRecentSalesSearch] = useState("");
  
  // Repayment Modal States (for pending orders)
  const [repaymentSale, setRepaymentSale] = useState<any | null>(null);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repayMethod, setRepayMethod] = useState<"CASH" | "UPI" | "CARD" | "SPLIT">("CASH");
  const [repayCashAmount, setRepayCashAmount] = useState("");
  const [repayUpiAmount, setRepayUpiAmount] = useState("");
  const [repayCardAmount, setRepayCardAmount] = useState("");
  const [repayUpiReference, setRepayUpiReference] = useState("");
  const [repayCardReference, setRepayCardReference] = useState("");

  // Search input reference for keyboard shortcut focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus modal price input on open
  useEffect(() => {
    if (selectedItemForModal) {
      setTimeout(() => {
        priceInputRef.current?.focus();
        priceInputRef.current?.select();
      }, 50);
    }
  }, [selectedItemForModal]);

  // 1. Fetch categories and items (supporting offline caching)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch categories
      let catsData = [];
      let itemsData = [];

      if (isOnline) {
        const catsRes = await fetch("/api/categories");
        if (catsRes.ok) {
          const res = await catsRes.json();
          catsData = res.categories;
          localStorage.setItem("cached_categories", JSON.stringify(catsData));
        }

        const itemsRes = await fetch("/api/items");
        if (itemsRes.ok) {
          const res = await itemsRes.json();
          itemsData = res.items.filter((it: Item) => it.isActive);
          localStorage.setItem("cached_items", JSON.stringify(itemsData));
        }
      } else {
        // Load from cache
        catsData = JSON.parse(localStorage.getItem("cached_categories") || "[]");
        itemsData = JSON.parse(localStorage.getItem("cached_items") || "[]");
        showToast("Offline mode: Loaded items from local cache.", "info");
      }

      setCategories(catsData);
      setItems(itemsData);
    } catch (error) {
      console.error("Fetch POS data error:", error);
      showToast("Failed to load POS data.", "error");
    } finally {
      setLoading(false);
    }
  }, [isOnline, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync pending offline sales when coming back online
  useEffect(() => {
    const syncOfflineSales = async () => {
      if (!isOnline) return;
      const pendingSales = JSON.parse(localStorage.getItem("pending_sales") || "[]");
      if (pendingSales.length === 0) return;

      showToast(`Online mode detected. Syncing ${pendingSales.length} offline transactions...`, "info");
      
      const remainingSales = [];
      for (const sale of pendingSales) {
        try {
          const res = await fetch("/api/sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sale),
          });
          if (res.ok) {
            console.log("Synced transaction successfully");
          } else {
            // Keep failing checkouts in queue
            remainingSales.push(sale);
          }
        } catch (e) {
          remainingSales.push(sale);
        }
      }

      localStorage.setItem("pending_sales", JSON.stringify(remainingSales));
      if (remainingSales.length === 0) {
        showToast("All offline transactions synced successfully!", "success");
        // Reload items to get latest stock levels
        fetchData();
      } else {
        showToast(`Failed to sync ${remainingSales.length} transactions. Will retry.`, "error");
      }
    };

    syncOfflineSales();
  }, [isOnline, fetchData, showToast]);

  const fetchRecentSales = useCallback(async () => {
    try {
      setLoadingRecentSales(true);
      const res = await fetch("/api/sales?limit=50");
      if (res.ok) {
        const data = await res.json();
        setRecentSales(data.sales || []);
      } else {
        showToast("Failed to fetch recent sales.", "error");
      }
    } catch (err) {
      console.error("Error fetching recent sales:", err);
      showToast("Error loading recent sales.", "error");
    } finally {
      setLoadingRecentSales(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (showRecentOrders) {
      fetchRecentSales();
    }
  }, [showRecentOrders, fetchRecentSales]);

  const handleRepaySplitPercentage = (target: "CASH" | "UPI" | "CARD", pct: number) => {
    if (!repaymentSale) return;
    const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
    const balanceDue = repaymentSale.totalAmount - totalPaid;
    const amt = (balanceDue * pct).toFixed(2);
    if (target === "CASH") {
      setRepayCashAmount(amt);
    } else if (target === "UPI") {
      setRepayUpiAmount(amt);
    } else if (target === "CARD") {
      setRepayCardAmount(amt);
    }
  };

  const executeRepayment = async () => {
    if (!repaymentSale) return;

    const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
    const balanceDue = repaymentSale.totalAmount - totalPaid;
    let paymentsPayload: any[] = [];

    if (repayMethod === "SPLIT") {
      const cashAmt = parseFloat(repayCashAmount) || 0;
      const upiAmt = parseFloat(repayUpiAmount) || 0;
      const cardAmt = parseFloat(repayCardAmount) || 0;

      if (cashAmt < 0 || upiAmt < 0 || cardAmt < 0) {
        showToast("Split amounts cannot be negative.", "error");
        return;
      }

      if (cashAmt === 0 && upiAmt === 0 && cardAmt === 0) {
        showToast("All split amounts cannot be zero.", "error");
        return;
      }

      const splitSum = cashAmt + upiAmt + cardAmt;
      if (balanceDue.toFixed(2) !== splitSum.toFixed(2)) {
        showToast(`Split sum (${formatCurrency(splitSum)}) must match remaining balance (${formatCurrency(balanceDue)}).`, "error");
        return;
      }

      if (cashAmt > 0) {
        paymentsPayload.push({
          method: "CASH",
          amount: cashAmt,
        });
      }
      if (upiAmt > 0) {
        paymentsPayload.push({
          method: "UPI",
          amount: upiAmt,
          referenceNo: repayUpiReference.trim() || undefined,
        });
      }
      if (cardAmt > 0) {
        paymentsPayload.push({
          method: "CARD",
          amount: cardAmt,
          referenceNo: repayCardReference.trim() || undefined,
        });
      }
    } else {
      paymentsPayload.push({
        method: repayMethod,
        amount: balanceDue,
        referenceNo: 
          repayMethod === "UPI" ? repayUpiReference.trim() || undefined : 
          repayMethod === "CARD" ? repayCardReference.trim() || undefined : undefined,
      });
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/sales/${repaymentSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PAID",
          payments: paymentsPayload,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast("Pending transaction marked as completed/paid!", "success");
        setShowRepaymentModal(false);
        setRepaymentSale(null);
        fetchRecentSales();
      } else {
        showToast(data.error || "Failed to update pending transaction.", "error");
      }
    } catch (error) {
      console.error("Repayment update error:", error);
      showToast("Network error. Failed to update transaction.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If pricing modal is open, let it handle Escape
      if (selectedItemForModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSelectedItemForModal(null);
        }
        return;
      }

      // F1 or Ctrl + S: Focus search
      if (e.key === "F1" || (e.ctrlKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl + Enter: Checkout
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (cart.length > 0 && !submitting) {
          triggerCheckout();
        }
      }
      // Esc: Close receipt or clear cart
      if (e.key === "Escape") {
        if (showReceipt) {
          setShowReceipt(false);
        } else if (cart.length > 0) {
          if (confirm("Are you sure you want to clear the current cart?")) {
            setCart([]);
            setCheckoutNotes("");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, submitting, showReceipt, selectedItemForModal]);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bakery-background">
        <Loader2 className="w-12 h-12 text-bakery-orange animate-spin" />
        <p className="text-sm text-bakery-muted mt-2">Loading POS workspace...</p>
      </div>
    );
  }

  // Open configuration modal on item click
  const handleItemClick = (item: Item) => {
    if (item.stock <= 0) {
      showToast("This item is out of stock.", "error");
      return;
    }
    setSelectedItemForModal(item);
    setModalPrice("");
    setModalQuantity(1);
    setModalNote("");
  };

  // Form submission handler inside modal
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    confirmAddItem();
  };

  const confirmAddItem = () => {
    if (!selectedItemForModal) return;
    const priceFloat = parseFloat(modalPrice);
    if (isNaN(priceFloat) || priceFloat < 0) {
      showToast("Please enter a valid price.", "error");
      return;
    }
    if (modalQuantity <= 0) {
      showToast("Quantity must be at least 1.", "error");
      return;
    }
    if (modalQuantity > selectedItemForModal.stock) {
      showToast(`Only ${selectedItemForModal.stock} units available in stock.`, "error");
      return;
    }

    setCart((prevCart) => {
      // Aggregate if product id, price, and note are identical
      const existingIndex = prevCart.findIndex(
        (it) => it.id === selectedItemForModal.id && it.price === priceFloat && it.note === modalNote.trim()
      );

      if (existingIndex > -1) {
        const existing = prevCart[existingIndex];
        const nextQty = existing.quantity + modalQuantity;
        if (nextQty > selectedItemForModal.stock) {
          showToast(`Only ${selectedItemForModal.stock} units available in stock.`, "error");
          return prevCart;
        }
        const updatedCart = [...prevCart];
        updatedCart[existingIndex] = { ...existing, quantity: nextQty };
        return updatedCart;
      }

      const cartLineId = `${selectedItemForModal.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      return [
        ...prevCart,
        {
          cartLineId,
          id: selectedItemForModal.id,
          name: selectedItemForModal.name,
          price: priceFloat,
          quantity: modalQuantity,
          stock: selectedItemForModal.stock,
          note: modalNote.trim() || undefined,
        },
      ];
    });

    setSelectedItemForModal(null);
  };

  // 4. Update cart item quantity
  const updateQty = (cartLineId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((it) => {
          if (it.cartLineId === cartLineId) {
            const nextQty = it.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > it.stock) {
              showToast(`Only ${it.stock} units available in stock.`, "error");
              return it;
            }
            return { ...it, quantity: nextQty };
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // 5. Remove item from cart
  const removeFromCart = (cartLineId: string) => {
    setCart((prevCart) => prevCart.filter((it) => it.cartLineId !== cartLineId));
  };

  // 6. Custom price update handler
  const handleCustomPriceChange = (cartLineId: string, value: string) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;

    setCart((prevCart) =>
      prevCart.map((it) =>
        it.cartLineId === cartLineId ? { ...it, price: parsed } : it
      )
    );
  };

  // 7. Calculate Cart Totals
  const getSubtotal = () => cart.reduce((acc, it) => acc + it.price * it.quantity, 0);

  // 8. Checkout submit execution
  const triggerCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod("CASH");
    setCustomerName("");
    setCustomerPhone("");
    setUpiReference("");
    setSplitCashAmount("");
    setSplitUpiAmount("");
    setSplitUpiReference("");
    setShowCheckoutModal(true);
  };

  const handleSplitPercentage = (target: "CASH" | "UPI" | "CARD", pct: number) => {
    const total = getSubtotal();
    const amt = (total * pct).toFixed(2);
    if (target === "CASH") {
      setSplitCashAmount(amt);
    } else if (target === "UPI") {
      setSplitUpiAmount(amt);
    } else if (target === "CARD") {
      setSplitCardAmount(amt);
    }
  };

  const executeCheckout = async () => {
    if (cart.length === 0) return;

    const totalAmount = getSubtotal();
    let paymentsPayload: any[] = [];

    if (paymentMethod === "SPLIT") {
      const cashAmt = parseFloat(splitCashAmount) || 0;
      const upiAmt = parseFloat(splitUpiAmount) || 0;
      const cardAmt = parseFloat(splitCardAmount) || 0;

      if (cashAmt < 0 || upiAmt < 0 || cardAmt < 0) {
        showToast("Split amounts cannot be negative.", "error");
        return;
      }

      if (cashAmt === 0 && upiAmt === 0 && cardAmt === 0) {
        showToast("All split amounts cannot be zero.", "error");
        return;
      }

      const splitSum = cashAmt + upiAmt + cardAmt;
      if (totalAmount.toFixed(2) !== splitSum.toFixed(2)) {
        showToast(`Split sum (${formatCurrency(splitSum)}) must match total (${formatCurrency(totalAmount)}).`, "error");
        return;
      }

      if (cashAmt > 0) {
        paymentsPayload.push({
          method: "CASH",
          amount: cashAmt,
        });
      }
      if (upiAmt > 0) {
        paymentsPayload.push({
          method: "UPI",
          amount: upiAmt,
          referenceNo: splitUpiReference.trim() || undefined,
        });
      }
      if (cardAmt > 0) {
        paymentsPayload.push({
          method: "CARD",
          amount: cardAmt,
          referenceNo: splitCardReference.trim() || undefined,
        });
      }
    } else {
      paymentsPayload.push({
        method: paymentMethod,
        amount: totalAmount,
        referenceNo: 
          paymentMethod === "UPI" ? upiReference.trim() || undefined : 
          paymentMethod === "CARD" ? cardReference.trim() || undefined : undefined,
      });
    }

    setSubmitting(true);
    const checkoutPayload = {
      items: cart.map((it) => ({
        id: it.id,
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        note: it.note || undefined,
      })),
      notes: checkoutNotes.trim() || undefined,
      payments: paymentsPayload,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      status: orderStatus,
    };

    if (isOnline) {
      try {
        const response = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkoutPayload),
        });

        const data = await response.json();

        if (response.ok) {
          showToast("Checkout completed successfully!", "success");
          setCompletedSale(data.sale);
          setShowReceipt(true);
          setCart([]);
          setCheckoutNotes("");
          setShowCheckoutModal(false);
          
          // Refresh item stocks & recent orders list
          fetchData();
          fetchRecentSales();
        } else {
          showToast(data.error || "Checkout transaction failed.", "error");
        }
      } catch (error) {
        console.error("Checkout submit error:", error);
        showToast("Network error. Checkout failed.", "error");
      } finally {
        setSubmitting(false);
      }
    } else {
      // Offline mode caching
      try {
        const pendingSales = JSON.parse(localStorage.getItem("pending_sales") || "[]");
        
        // Generate a mock receipt representation for offline confirmation
        const mockOfflineTxId = `SD-OFF-${Date.now().toString().slice(-6)}`;
        const localMockSale = {
          id: mockOfflineTxId,
          transactionId: mockOfflineTxId,
          totalAmount: totalAmount,
          notes: checkoutNotes,
          createdAt: new Date().toISOString(),
          staff: { name: user?.name || "Owner" },
          customerName: customerName.trim() || null,
          customerPhone: customerPhone.trim() || null,
          saleItems: cart.map((it) => ({
            id: it.id,
            itemName: it.name,
            price: it.price,
            quantity: it.quantity,
            totalAmount: it.price * it.quantity,
          })),
          payments: paymentsPayload.map((p, index) => ({
            id: `pay-off-${index}-${Date.now()}`,
            method: p.method,
            amount: p.amount,
            referenceNo: p.referenceNo || null,
          })),
        };

        pendingSales.push(checkoutPayload);
        localStorage.setItem("pending_sales", JSON.stringify(pendingSales));

        // Deduct stocks in local state immediately so user sees correct numbers
        const updatedLocalItems = items.map((it) => {
          const cartItem = cart.find((ci) => ci.id === it.id);
          if (cartItem) {
            return { ...it, stock: Math.max(0, it.stock - cartItem.quantity) };
          }
          return it;
        });
        setItems(updatedLocalItems);
        localStorage.setItem("cached_items", JSON.stringify(updatedLocalItems));

        showToast("Offline: Sale queued locally in cache. Syncing automatically when online.", "success");
        
        setCompletedSale(localMockSale);
        setShowReceipt(true);
        setCart([]);
        setCheckoutNotes("");
        setShowCheckoutModal(false);
      } catch (e) {
        console.error("Failed to queue offline sale:", e);
        showToast("Failed to complete checkout locally.", "error");
      } finally {
        setSubmitting(false);
      }
    }
  };

  // 9. Trigger Receipt Print
  const handlePrintReceipt = () => {
    window.print();
  };

  // Filters catalog list
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "All" || item.categoryId === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Side: Catalog Selection Grid (8 cols on large screens) */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden h-full">
          {/* Header Search & Category Selection */}
          <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xs">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-bakery-muted">
                <Search className="w-4 h-4" />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search bakery items... (F1)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-2.5 rounded-lg border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all text-sm"
              />
            </div>

            {/* Offline badge & Recent orders button */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {!isOnline && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-bakery-gold border border-bakery-gold/20">
                  <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                  <span>Offline POS Enabled</span>
                </div>
              )}
              <button
                onClick={() => setShowRecentOrders(true)}
                className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border border-bakery-orange/30 bg-bakery-orange/5 text-bakery-orange hover:bg-bakery-orange/10 flex items-center gap-2 cursor-pointer"
              >
                <Receipt className="w-4 h-4 text-bakery-orange" />
                <span>Recent Orders</span>
              </button>
            </div>
          </div>

          {/* Categories Tab selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-bakery-orange text-white border-bakery-orange shadow-xs"
                    : "bg-bakery-card text-bakery-muted-foreground dark:text-bakery-muted-foreground border-bakery-border hover:bg-bakery-cream dark:hover:bg-bakery-dark"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Catalog Item Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 text-bakery-orange animate-spin" />
                <p className="text-sm text-bakery-muted">Loading catalog items...</p>
              </div>
            ) : !selectedCategory ? (
              <div className="text-center py-24 text-bakery-muted bg-bakery-card rounded-xl border border-bakery-border flex flex-col items-center justify-center gap-3 shadow-xs">
                <Sparkles className="w-10 h-10 text-bakery-orange/30 animate-pulse" />
                <p className="text-sm font-semibold tracking-wide">
                  Select a category to begin billing
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20 text-bakery-muted bg-bakery-card rounded-xl border border-bakery-border">
                No items found matching the filter criteria.
              </div>
            ) : (
              <div className="pos-grid pb-6">
                {filteredItems.map((item) => {
                  const isOutOfStock = item.stock <= 0;
                  const isLowStock = !isOutOfStock && item.stock <= item.lowStockThreshold;

                  return (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      disabled={isOutOfStock}
                      className={`relative flex flex-col p-4 rounded-xl border bg-bakery-card transition-all text-left group shadow-xs hover:shadow-md cursor-pointer select-none ${
                        isOutOfStock
                          ? "opacity-50 border-bakery-border border-bakery-border pointer-events-none"
                          : "border-bakery-border hover:border-bakery-orange"
                      }`}
                    >
                      {/* Low stock badge alert */}
                      {isOutOfStock ? (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-sm text-[10px] font-extrabold uppercase bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                          Sold Out
                        </span>
                      ) : isLowStock ? (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-sm text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                          Low Stock: {item.stock}
                        </span>
                      ) : null}

                      <span className="text-[10px] text-bakery-muted uppercase tracking-wider font-bold mb-1">
                        {item.category.name}
                      </span>
                      <span className="font-bold text-sm text-bakery-foreground group-hover:text-bakery-orange dark:group-hover:text-bakery-orange transition-colors line-clamp-2 min-h-[40px]">
                        {item.name}
                      </span>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-bakery-muted font-semibold group-hover:text-bakery-orange transition-colors">
                          Set Price & Qty
                        </span>
                        <div className="p-1.5 rounded-lg bg-bakery-cream dark:bg-bakery-dark group-hover:bg-bakery-orange group-hover:text-white dark:group-hover:bg-bakery-orange transition-all">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Billing Cart Control Panel (4 cols on large screens) */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden h-full">
          <div className="glass-panel p-4 rounded-xl shadow-md border border-bakery-border flex flex-col h-full bg-bakery-card relative overflow-hidden">
            <h2 className="text-lg font-bold border-b border-bakery-border pb-3 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-bakery-orange" /> Active Invoice
            </h2>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-bakery-muted text-center">
                  <ShoppingCart className="w-12 h-12 text-bakery-muted-foreground mb-2 stroke-1" />
                  <p className="text-sm font-semibold">Your cart is empty.</p>
                  <p className="text-xs text-bakery-muted mt-1">Select items from the catalog.</p>
                </div>
              ) : (
                cart.map((cartItem) => (
                  <div
                    key={cartItem.cartLineId}
                    className="flex flex-col gap-1 p-2.5 rounded-lg border border-bakery-border bg-bakery-background/40 hover:bg-bakery-background transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm leading-tight text-bakery-foreground">
                          {cartItem.name}
                        </span>
                        {cartItem.note && (
                          <span className="text-[10px] text-bakery-orange font-semibold italic bg-bakery-orange/5 px-1.5 py-0.5 rounded-sm border border-bakery-orange/10 max-w-fit">
                            Note: {cartItem.note}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(cartItem.cartLineId)}
                        className="text-bakery-muted hover:text-rose-500 transition-colors p-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2 gap-2">
                      {/* Price adjustment field */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-bakery-muted">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          value={cartItem.price}
                          onChange={(e) => handleCustomPriceChange(cartItem.cartLineId, e.target.value)}
                          className="w-16 px-1.5 py-0.5 rounded-md border border-bakery-border bg-bakery-background text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange"
                          title="Click to override item price manually"
                        />
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center border border-bakery-border rounded-lg bg-bakery-card">
                        <button
                          onClick={() => updateQty(cartItem.cartLineId, -1)}
                          className="p-1 px-1.5 text-bakery-muted hover:text-bakery-foreground transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold px-2">{cartItem.quantity}</span>
                        <button
                          onClick={() => updateQty(cartItem.cartLineId, 1)}
                          className="p-1 px-1.5 text-bakery-muted hover:text-bakery-foreground transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Total */}
                      <span className="font-extrabold text-sm text-bakery-orange dark:text-bakery-orange">
                        {formatCurrency(cartItem.price * cartItem.quantity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Notes & Summary Checkout */}
            <div className="border-t border-bakery-border pt-4 space-y-4">
              <div>
                <textarea
                  placeholder="Add notes to transaction (optional)..."
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  className="w-full h-16 p-2 rounded-lg border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-bakery-muted">
                  <span>Subtotal</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-bakery-border pt-2 text-bakery-foreground">
                  <span>Total Amount</span>
                  <span className="text-lg font-extrabold text-bakery-orange dark:text-bakery-orange">
                    {formatCurrency(getSubtotal())}
                  </span>
                </div>
              </div>

              <button
                onClick={triggerCheckout}
                disabled={cart.length === 0 || submitting}
                className="w-full py-3.5 rounded-xl text-white font-semibold bg-gradient-to-r from-bakery-orange to-bakery-orange-dark active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Receipt className="w-5 h-5" /> Proceed to Payment (Ctrl+Enter)
              </button>

              {/* Keyboard Shortcuts helper block */}
              <div className="text-[10px] text-bakery-muted flex items-center justify-center gap-3 border-t border-bakery-border pt-3 mt-1">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 border rounded-md">F1</kbd> Search
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 border rounded-md">Ctrl+Enter</kbd> Bill
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 border rounded-md">Esc</kbd> Clear
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 10. Thermal print receipt modal (AnimatePresence) */}
      <AnimatePresence>
        {showReceipt && completedSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-bakery-card text-black p-6 rounded-2xl max-w-sm w-full shadow-2xl relative border border-bakery-border/50 max-h-[90vh] flex flex-col"
            >
              {/* Modal controls */}
              <div className="absolute top-4 right-4 flex gap-2 print:hidden">
                <button
                  onClick={() => setShowReceipt(false)}
                  className="p-1 rounded-full bg-bakery-background hover:bg-bakery-background/80 text-bakery-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Thermal Invoice Print Content (Id: printable-receipt) */}
              <div id="printable-receipt" className="flex-1 overflow-y-auto font-mono text-xs pr-1">
                <div className="text-center space-y-1 pb-4 border-b border-dashed border-bakery-border">
                  <h2 className="text-lg font-bold">VCAKES</h2>
                  <p className="text-[10px] text-bakery-muted">Luxury Boutique Bakery Cafe</p>
                  <p className="text-[10px] text-bakery-muted">Tel: +91 98765 43210</p>
                </div>

                <div className="py-3 border-b border-dashed border-bakery-border space-y-1 text-[10px]">
                  <p><strong>TXID:</strong> {completedSale.transactionId}</p>
                  <p><strong>Date:</strong> {new Date(completedSale.createdAt).toLocaleString()}</p>
                  {completedSale.customerName && <p><strong>Customer:</strong> {completedSale.customerName} ({completedSale.customerPhone || "N/A"})</p>}
                  {completedSale.notes && <p><strong>Notes:</strong> {completedSale.notes}</p>}
                </div>

                {/* Invoice Items Table */}
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
                    {completedSale.saleItems?.map((sItem: any) => (
                      <tr key={sItem.id || sItem.itemName} className="border-b border-bakery-border/30">
                        <td className="py-1.5 font-semibold max-w-[120px] truncate">{sItem.itemName}</td>
                        <td className="py-1.5 text-center">{sItem.quantity}</td>
                        <td className="py-1.5 text-right">{formatCurrency(sItem.price)}</td>
                        <td className="py-1.5 text-right">{formatCurrency(sItem.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary & Payments */}
                <div className="py-3 space-y-1 text-right border-t border-dashed border-bakery-border pt-2">
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL AMOUNT:</span>
                    <span>{formatCurrency(completedSale.totalAmount)}</span>
                  </div>
                  <div className="pt-2 text-[10px] text-left space-y-1">
                    <p className="font-bold border-b border-bakery-border/50 pb-0.5">Payment Details:</p>
                    {completedSale.payments?.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-[9px] text-bakery-muted-foreground">
                        <span>• {p.method} {p.referenceNo ? `(Ref: ${p.referenceNo})` : ""}</span>
                        <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center border-t border-dashed border-bakery-border pt-4 pb-2 space-y-1">
                  <p className="text-[9px] text-bakery-muted uppercase tracking-widest font-bold">Thank You For Your Visit!</p>
                  <p className="text-[8px] text-bakery-muted">Securely saved in Cloud POS Database</p>
                  <div className="flex justify-center pt-2">
                    {/* Mock QR-code-ready representation for future invoicing */}
                    <div className="w-16 h-16 bg-bakery-background border border-bakery-border flex items-center justify-center p-1 rounded-sm">
                      <span className="text-[8px] text-bakery-muted font-bold text-center">QR Code Area</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons inside receipt dialog */}
              <div className="mt-6 flex gap-3 print:hidden">
                <button
                  onClick={handlePrintReceipt}
                  className="flex-1 py-3 px-4 rounded-xl text-white font-bold bg-bakery-orange hover:bg-bakery-orange/95 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4" /> Print Receipt
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-bakery-foreground bg-bakery-background hover:bg-bakery-background/80 font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  New Sale
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment checkout details modal */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-lg w-full shadow-2xl relative border border-bakery-border bg-bakery-card flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-black dark:text-white"
            >
              <div className="flex justify-between items-start border-b border-bakery-border pb-3">
                <div>
                  <h3 className="text-xl font-extrabold text-bakery-foreground">
                    Complete Billing Payment
                  </h3>
                  <p className="text-xs text-bakery-muted">
                    Billed Total: <strong className="text-bakery-orange dark:text-bakery-orange">{formatCurrency(getSubtotal())}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="p-1.5 rounded-full hover:bg-bakery-background hover:bg-bakery-background text-bakery-muted hover:text-bakery-muted-foreground transition-colors animate-pulse"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer details */}
              {/* Order Status Selector */}
              <div>
                <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1.5">
                  Order Fulfillment Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderStatus("PAID")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      orderStatus === "PAID"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-900/10"
                        : "border-bakery-border bg-bakery-card text-bakery-muted hover:bg-bakery-background hover:bg-bakery-background"
                    }`}
                  >
                    <span>🟢</span> Paid & Delivered
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderStatus("PENDING")}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      orderStatus === "PENDING"
                        ? "bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-900/10"
                        : "border-bakery-border bg-bakery-card text-bakery-muted hover:bg-bakery-background hover:bg-bakery-background"
                    }`}
                  >
                    <span>🟡</span> Pending Cake Booking
                  </button>
                </div>
              </div>

              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">
                    Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="block w-full px-3 py-2 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xs text-bakery-foreground focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">
                    Customer Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="block w-full px-3 py-2 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xs text-bakery-foreground focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1.5">
                  Select Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["CASH", "UPI", "CARD", "SPLIT"] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-3 px-1 rounded-xl border font-bold text-[10px] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethod === method
                          ? "bg-bakery-orange border-bakery-orange text-white shadow-xs"
                          : "border-bakery-border bg-bakery-card text-bakery-muted-foreground dark:text-bakery-muted-foreground hover:bg-bakery-cream dark:hover:bg-bakery-dark"
                      }`}
                    >
                      <span className="text-base">
                        {method === "CASH" ? "💵" : method === "UPI" ? "📱" : method === "CARD" ? "💳" : "🔀"}
                      </span>
                      <span>
                        {method === "CASH" ? "Cash" : method === "UPI" ? "UPI" : method === "CARD" ? "Card" : "Split Pay"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Payment Fields */}
              <div className="flex-1 space-y-4">
                {paymentMethod === "CASH" && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-center">
                    <p className="text-xs font-semibold">Collect Cash Amount:</p>
                    <p className="text-2xl font-black mt-1">{formatCurrency(getSubtotal())}</p>
                  </div>
                )}

                {paymentMethod === "UPI" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-center">
                      <p className="text-xs font-semibold">Scan UPI QR & Verify:</p>
                      <p className="text-2xl font-black mt-1">{formatCurrency(getSubtotal())}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">
                        UPI Transaction ID / Ref Number (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 12-digit UPI reference number"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value)}
                        className="block w-full px-3 py-2.5 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xs focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 text-bakery-foreground"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "CARD" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300 text-center">
                      <p className="text-xs font-semibold">Swipe Card & Collect:</p>
                      <p className="text-2xl font-black mt-1">{formatCurrency(getSubtotal())}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">
                        Card Trans Ref No / Last 4 Digits (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Last 4 digits or card terminal reference ID"
                        value={cardReference}
                        onChange={(e) => setCardReference(e.target.value)}
                        className="block w-full px-3 py-2.5 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xs focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 text-bakery-foreground"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "SPLIT" && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider">
                      Configure Cash + UPI + Card Split Allocation
                    </label>

                    {/* Cash Portion */}
                    <div className="p-3 border border-bakery-border rounded-xl bg-bakery-background/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-bakery-foreground">Cash Amount</span>
                        <span className="text-[10px] text-bakery-muted font-semibold">Allocated</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted font-bold text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={splitCashAmount}
                          onChange={(e) => setSplitCashAmount(e.target.value)}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs font-extrabold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        {([0.25, 0.5, 0.75, 1.0] as const).map((pct) => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => handleSplitPercentage("CASH", pct)}
                            className="flex-1 py-1 rounded-md text-[9px] font-extrabold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UPI Portion */}
                    <div className="p-3 border border-bakery-border rounded-xl bg-bakery-background/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-bakery-foreground">UPI Amount</span>
                        <span className="text-[10px] text-bakery-muted font-semibold">Allocated</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted font-bold text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={splitUpiAmount}
                          onChange={(e) => setSplitUpiAmount(e.target.value)}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs font-extrabold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        {([0.25, 0.5, 0.75, 1.0] as const).map((pct) => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => handleSplitPercentage("UPI", pct)}
                            className="flex-1 py-1 rounded-md text-[9px] font-extrabold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="UPI Reference No (Optional)"
                          value={splitUpiReference}
                          onChange={(e) => setSplitUpiReference(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-bakery-border bg-bakery-background text-[10px] focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white placeholder-bakery-muted/50"
                        />
                      </div>
                    </div>

                    {/* Card Portion */}
                    <div className="p-3 border border-bakery-border rounded-xl bg-bakery-background/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-bakery-foreground">Card Amount</span>
                        <span className="text-[10px] text-bakery-muted font-semibold">Allocated</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted font-bold text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={splitCardAmount}
                          onChange={(e) => setSplitCardAmount(e.target.value)}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs font-extrabold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        {([0.25, 0.5, 0.75, 1.0] as const).map((pct) => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => handleSplitPercentage("CARD", pct)}
                            className="flex-1 py-1 rounded-md text-[9px] font-extrabold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="Card Terminal Reference ID (Optional)"
                          value={splitCardReference}
                          onChange={(e) => setSplitCardReference(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-bakery-border bg-bakery-background text-[10px] focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white placeholder-bakery-muted/50"
                        />
                      </div>
                    </div>

                    {/* Split Totals Summary Box */}
                    {(() => {
                      const totalBill = getSubtotal();
                      const allocatedSum = (parseFloat(splitCashAmount) || 0) + (parseFloat(splitUpiAmount) || 0) + (parseFloat(splitCardAmount) || 0);
                      const remBalance = totalBill - allocatedSum;
                      const hasMismatch = totalBill.toFixed(2) !== allocatedSum.toFixed(2);

                      return (
                        <div className={`p-3 rounded-xl border text-xs font-semibold space-y-1 mt-2 ${
                          hasMismatch
                            ? "bg-amber-500/10 border-bakery-gold/20 text-bakery-gold"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          <div className="flex justify-between">
                            <span>Billed Total:</span>
                            <span className="font-extrabold">{formatCurrency(totalBill)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Allocated:</span>
                            <span className="font-extrabold">{formatCurrency(allocatedSum)}</span>
                          </div>
                          <div className="flex justify-between border-t border-dashed border-bakery-border border-bakery-border pt-1 mt-1">
                            <span>Remaining to Pay:</span>
                            <span className={`font-black ${remBalance > 0 ? "text-amber-600 dark:text-amber-400" : remBalance < 0 ? "text-rose-500" : ""}`}>
                              {formatCurrency(remBalance)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-bakery-border">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-bakery-foreground bg-bakery-background hover:bg-bakery-background/80 dark:text-bakery-muted-foreground dark:bg-gray-800 hover:bg-bakery-background font-bold text-center cursor-pointer transition-colors text-xs text-bakery-foreground"
                >
                  Back to Invoice
                </button>
                <button
                  type="button"
                  onClick={executeCheckout}
                  disabled={submitting || (
                    paymentMethod === "SPLIT" &&
                    getSubtotal().toFixed(2) !== ((parseFloat(splitCashAmount) || 0) + (parseFloat(splitUpiAmount) || 0) + (parseFloat(splitCardAmount) || 0)).toFixed(2)
                  )}
                  className="flex-1 py-3 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-bakery-orange to-bakery-orange-dark disabled:opacity-50 disabled:pointer-events-none text-center cursor-pointer transition-colors text-xs shadow-md"
                >
                  {submitting ? "Processing..." : "Complete Sale"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item pricing and quantity configuration modal */}
      <AnimatePresence>
        {selectedItemForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-md w-full shadow-2xl relative border border-bakery-border bg-bakery-card flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-bakery-muted uppercase tracking-wider font-bold">
                    {selectedItemForModal.category.name}
                  </span>
                  <h3 className="text-xl font-extrabold text-bakery-foreground mt-0.5">
                    {selectedItemForModal.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedItemForModal(null)}
                  className="p-1.5 rounded-full hover:bg-bakery-background hover:bg-bakery-background text-bakery-muted hover:text-bakery-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleModalSubmit} className="space-y-4">
                {/* Price input */}
                <div>
                  <label className="block text-xs font-bold text-bakery-muted uppercase tracking-wider mb-1.5">
                    Price per Unit *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xl font-bold text-bakery-muted">
                      ₹
                    </span>
                    <input
                      ref={priceInputRef}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={modalPrice}
                      onChange={(e) => setModalPrice(e.target.value)}
                      className="block w-full pl-8 pr-4 py-3 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xl font-extrabold text-bakery-foreground focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Quantity input */}
                <div>
                  <label className="block text-xs font-bold text-bakery-muted uppercase tracking-wider mb-1.5">
                    Quantity
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                      className="w-12 h-12 flex items-center justify-center rounded-xl border border-bakery-border bg-bakery-background text-bakery-muted-foreground dark:text-bakery-muted-foreground hover:bg-bakery-background hover:bg-bakery-background transition-colors"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={selectedItemForModal.stock}
                      value={modalQuantity}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value);
                        if (!isNaN(parsed) && parsed > 0) {
                          setModalQuantity(Math.min(selectedItemForModal.stock, parsed));
                        }
                      }}
                      className="w-full text-center py-3 rounded-xl border border-bakery-border bg-bakery-background font-extrabold text-bakery-foreground focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setModalQuantity((q) => Math.min(selectedItemForModal.stock, q + 1))}
                      className="w-12 h-12 flex items-center justify-center rounded-xl border border-bakery-border bg-bakery-background text-bakery-muted-foreground dark:text-bakery-muted-foreground hover:bg-bakery-background hover:bg-bakery-background transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <span className="text-[11px] text-bakery-muted block mt-1 text-center font-semibold">
                    Available Stock: {selectedItemForModal.stock} units
                  </span>
                </div>

                {/* Note input */}
                <div>
                  <label className="block text-xs font-bold text-bakery-muted uppercase tracking-wider mb-1.5">
                    Optional Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Extra toasted, birthday message..."
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-sm text-bakery-foreground focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 focus:border-bakery-orange transition-all"
                  />
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2 pt-2 border-t border-bakery-border">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedItemForModal(null)}
                      className="flex-1 py-3 px-4 rounded-xl text-bakery-foreground bg-bakery-background hover:bg-bakery-background/80 dark:text-bakery-muted-foreground dark:bg-gray-800 hover:bg-bakery-background font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      Cancel (Esc)
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-bakery-orange to-bakery-orange-dark flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      Add to Sale (Enter)
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 11. Recent & Pending Orders Drawer */}
      <AnimatePresence>
        {showRecentOrders && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={() => setShowRecentOrders(false)} />
            
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-bakery-card border-l border-bakery-border shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-4 border-b border-bakery-border flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-bakery-foreground flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-bakery-orange" />
                    Recent & Pending Orders
                  </h3>
                  <p className="text-xs text-bakery-muted">View daily transactions & fulfill pending orders</p>
                </div>
                <button
                  onClick={() => setShowRecentOrders(false)}
                  className="p-1.5 rounded-full hover:bg-bakery-background text-bakery-muted hover:text-bakery-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search bar inside drawer */}
              <div className="p-4 border-b border-bakery-border bg-bakery-background/30">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search transaction, customer name..."
                    value={recentSalesSearch}
                    onChange={(e) => setRecentSalesSearch(e.target.value)}
                    className="block w-full pl-9 pr-4 py-2 rounded-lg border border-bakery-border bg-bakery-card placeholder-bakery-muted/50 focus:outline-hidden focus:ring-1 focus:ring-bakery-orange/40 text-xs text-bakery-foreground bg-bakery-background"
                  />
                </div>
              </div>

              {/* Sales List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingRecentSales ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <Loader2 className="w-8 h-8 text-bakery-orange animate-spin" />
                    <p className="text-xs text-bakery-muted">Loading orders history...</p>
                  </div>
                ) : recentSales.length === 0 ? (
                  <div className="text-center py-20 text-xs text-bakery-muted">
                    No recent orders found.
                  </div>
                ) : (
                  (() => {
                    const filtered = recentSales.filter(sale => {
                      const q = recentSalesSearch.toLowerCase();
                      return (
                        sale.transactionId.toLowerCase().includes(q) ||
                        (sale.customerName && sale.customerName.toLowerCase().includes(q)) ||
                        (sale.customerPhone && sale.customerPhone.includes(q))
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-20 text-xs text-bakery-muted">
                          No matching orders found.
                        </div>
                      );
                    }

                    return filtered.map((sale) => {
                      const totalPaid = sale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                      const remaining = Math.max(0, sale.totalAmount - totalPaid);
                      
                      return (
                        <div
                          key={sale.id}
                          className={`p-4 rounded-xl border transition-all space-y-3 bg-bakery-background/40 ${
                            sale.status === "PENDING"
                              ? "border-amber-500/40 hover:border-amber-500 shadow-[inset_0_1px_3px_rgba(245,158,11,0.05)]"
                              : "border-bakery-border hover:border-bakery-orange/50"
                          }`}
                        >
                          {/* Top Row: ID and Status */}
                          <div className="flex justify-between items-start">
                            <div className="space-y-0.5">
                              <span className="text-xs font-mono font-bold text-bakery-foreground">
                                {sale.transactionId}
                              </span>
                              <div className="text-[10px] text-bakery-muted">
                                {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                              sale.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : sale.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-rose-100 text-rose-600 dark:text-rose-400 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}>
                              {sale.status === "PENDING" ? "Cake Booking" : sale.status}
                            </span>
                          </div>

                          {/* Customer info if any */}
                          {(sale.customerName || sale.customerPhone) && (
                            <div className="text-xs font-semibold bg-bakery-card/80 p-2 rounded-lg border border-bakery-border/50 text-bakery-foreground">
                              👤 {sale.customerName || "Walk-in"} {sale.customerPhone ? `(${sale.customerPhone})` : ""}
                            </div>
                          )}

                          {/* Items summary */}
                          <div className="text-[11px] text-bakery-muted space-y-0.5 border-t border-b border-bakery-border/40 py-2">
                            {sale.saleItems?.map((item: any) => (
                              <div key={item.id} className="flex flex-col gap-0.5">
                                <div className="flex justify-between">
                                  <span>{item.itemName} x{item.quantity}</span>
                                  <span>{formatCurrency(item.totalAmount)}</span>
                                </div>
                                {item.note && (
                                  <span className="text-[9px] text-bakery-orange italic">
                                    Note: {item.note}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Total amounts */}
                          <div className="flex justify-between items-baseline pt-1">
                            <span className="text-xs font-bold text-bakery-foreground">Total Billed:</span>
                            <span className="text-sm font-extrabold text-bakery-orange dark:text-bakery-orange">
                              {formatCurrency(sale.totalAmount)}
                            </span>
                          </div>

                          {/* Split/Remaining breakdown if PENDING */}
                          {sale.status === "PENDING" && (
                            <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-950/30 rounded-lg p-2.5 space-y-1 text-xs">
                              <div className="flex justify-between text-bakery-muted font-semibold">
                                <span>Advance Deposit:</span>
                                <span>{formatCurrency(totalPaid)}</span>
                              </div>
                              <div className="flex justify-between text-amber-700 dark:text-amber-400 font-bold border-t border-dashed border-bakery-gold/20 pt-1 mt-1">
                                <span>Balance Due:</span>
                                <span>{formatCurrency(remaining)}</span>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => {
                                setCompletedSale(sale);
                                setShowReceipt(true);
                              }}
                              className="flex-1 py-2 px-3 rounded-lg text-[10px] font-bold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted hover:text-bakery-foreground flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              Reprint
                            </button>

                            {sale.status === "PENDING" && (
                              <button
                                onClick={() => {
                                  setRepaymentSale(sale);
                                  setRepayMethod("CASH");
                                  setRepayCashAmount(remaining.toFixed(2));
                                  setRepayUpiAmount("");
                                  setRepayCardAmount("");
                                  setRepayUpiReference("");
                                  setRepayCardReference("");
                                  setShowRepaymentModal(true);
                                }}
                                className="flex-1 py-2 px-3 rounded-lg text-[10px] font-bold text-white bg-gradient-to-r from-bakery-orange to-bakery-orange-dark flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 12. Repayment Modal for Pending Sales */}
      <AnimatePresence>
        {showRepaymentModal && repaymentSale && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-lg w-full shadow-2xl relative border border-bakery-border bg-bakery-card flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-black dark:text-white"
            >
              <div className="flex justify-between items-start border-b border-bakery-border pb-3">
                <div>
                  <h3 className="text-xl font-extrabold text-bakery-foreground">
                    Fulfill Outstanding Balance
                  </h3>
                  <p className="text-xs text-bakery-muted">
                    Transaction ID: <strong className="font-mono text-bakery-orange dark:text-bakery-orange">{repaymentSale.transactionId}</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRepaymentModal(false);
                    setRepaymentSale(null);
                  }}
                  className="p-1.5 rounded-full hover:bg-bakery-background hover:bg-bakery-background text-bakery-muted hover:text-bakery-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Repayment Stats */}
              {(() => {
                const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                const balanceDue = repaymentSale.totalAmount - totalPaid;
                return (
                  <div className="grid grid-cols-3 gap-2 text-center bg-bakery-background/40 p-3 rounded-xl border border-bakery-border">
                    <div>
                      <span className="block text-[9px] font-bold text-bakery-muted uppercase">Total Bill</span>
                      <span className="text-sm font-extrabold">{formatCurrency(repaymentSale.totalAmount)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-bakery-muted uppercase">Paid So Far</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-bakery-muted uppercase">Balance Due</span>
                      <span className="text-sm font-extrabold text-bakery-orange dark:text-bakery-orange">{formatCurrency(balanceDue)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1.5">
                  Select Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["CASH", "UPI", "CARD", "SPLIT"] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => {
                        setRepayMethod(method);
                        const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                        const balanceDue = repaymentSale.totalAmount - totalPaid;
                        if (method === "CASH") {
                          setRepayCashAmount(balanceDue.toFixed(2));
                          setRepayUpiAmount("");
                          setRepayCardAmount("");
                        } else if (method === "UPI") {
                          setRepayUpiAmount(balanceDue.toFixed(2));
                          setRepayCashAmount("");
                          setRepayCardAmount("");
                        } else if (method === "CARD") {
                          setRepayCardAmount(balanceDue.toFixed(2));
                          setRepayCashAmount("");
                          setRepayUpiAmount("");
                        } else {
                          setRepayCashAmount("");
                          setRepayUpiAmount("");
                          setRepayCardAmount("");
                        }
                      }}
                      className={`py-3 px-1 rounded-xl border font-bold text-[10px] transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        repayMethod === method
                          ? "bg-bakery-orange border-bakery-orange text-white shadow-xs"
                          : "border-bakery-border bg-bakery-card text-bakery-muted-foreground dark:text-bakery-muted-foreground hover:bg-bakery-cream dark:hover:bg-bakery-dark"
                      }`}
                    >
                      <span className="text-base">
                        {method === "CASH" ? "💵" : method === "UPI" ? "📱" : method === "CARD" ? "💳" : "🔀"}
                      </span>
                      <span>
                        {method === "CASH" ? "Cash" : method === "UPI" ? "UPI" : method === "CARD" ? "Card" : "Split Pay"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Payment Fields */}
              <div className="flex-1 space-y-4">
                {repayMethod === "CASH" && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-center">
                    <p className="text-xs font-semibold">Collect Cash Amount:</p>
                    <p className="text-2xl font-black mt-1">
                      {(() => {
                        const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                        return formatCurrency(repaymentSale.totalAmount - totalPaid);
                      })()}
                    </p>
                  </div>
                )}

                {repayMethod === "UPI" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-center">
                      <p className="text-xs font-semibold">Scan UPI QR & Verify:</p>
                      <p className="text-2xl font-black mt-1">
                        {(() => {
                          const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                          return formatCurrency(repaymentSale.totalAmount - totalPaid);
                        })()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">
                        UPI Transaction ID / Ref Number (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 12-digit UPI reference number"
                        value={repayUpiReference}
                        onChange={(e) => setRepayUpiReference(e.target.value)}
                        className="block w-full px-3 py-2.5 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xs focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 text-bakery-foreground"
                      />
                    </div>
                  </div>
                )}

                {repayMethod === "CARD" && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 text-purple-800 dark:text-purple-300 text-center">
                      <p className="text-xs font-semibold">Swipe Card & Collect:</p>
                      <p className="text-2xl font-black mt-1">
                        {(() => {
                          const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                          return formatCurrency(repaymentSale.totalAmount - totalPaid);
                        })()}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider mb-1">
                        Card Trans Ref No / Last 4 Digits (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Last 4 digits or card terminal reference ID"
                        value={repayCardReference}
                        onChange={(e) => setRepayCardReference(e.target.value)}
                        className="block w-full px-3 py-2.5 rounded-xl border border-bakery-border bg-bakery-background placeholder-bakery-muted/50 text-xs focus:outline-hidden focus:ring-2 focus:ring-bakery-orange/40 text-bakery-foreground"
                      />
                    </div>
                  </div>
                )}

                {repayMethod === "SPLIT" && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-bakery-muted uppercase tracking-wider">
                      Configure Cash + UPI + Card Split Allocation
                    </label>

                    {/* Cash Portion */}
                    <div className="p-3 border border-bakery-border rounded-xl bg-bakery-background/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-bakery-foreground">Cash Amount</span>
                        <span className="text-[10px] text-bakery-muted font-semibold">Allocated</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted font-bold text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={repayCashAmount}
                          onChange={(e) => setRepayCashAmount(e.target.value)}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs font-extrabold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        {([0.25, 0.5, 0.75, 1.0] as const).map((pct) => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => handleRepaySplitPercentage("CASH", pct)}
                            className="flex-1 py-1 rounded-md text-[9px] font-extrabold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* UPI Portion */}
                    <div className="p-3 border border-bakery-border rounded-xl bg-bakery-background/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-bakery-foreground">UPI Amount</span>
                        <span className="text-[10px] text-bakery-muted font-semibold">Allocated</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted font-bold text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={repayUpiAmount}
                          onChange={(e) => setRepayUpiAmount(e.target.value)}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs font-extrabold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        {([0.25, 0.5, 0.75, 1.0] as const).map((pct) => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => handleRepaySplitPercentage("UPI", pct)}
                            className="flex-1 py-1 rounded-md text-[9px] font-extrabold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="UPI Reference No (Optional)"
                          value={repayUpiReference}
                          onChange={(e) => setRepayUpiReference(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-bakery-border bg-bakery-background text-[10px] focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white placeholder-bakery-muted/50"
                        />
                      </div>
                    </div>

                    {/* Card Portion */}
                    <div className="p-3 border border-bakery-border rounded-xl bg-bakery-background/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-bakery-foreground">Card Amount</span>
                        <span className="text-[10px] text-bakery-muted font-semibold">Allocated</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-bakery-muted font-bold text-xs">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={repayCardAmount}
                          onChange={(e) => setRepayCardAmount(e.target.value)}
                          className="w-full pl-6 pr-2 py-2 rounded-lg border border-bakery-border bg-bakery-background text-xs font-extrabold focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white"
                        />
                      </div>
                      <div className="flex gap-1">
                        {([0.25, 0.5, 0.75, 1.0] as const).map((pct) => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => handleRepaySplitPercentage("CARD", pct)}
                            className="flex-1 py-1 rounded-md text-[9px] font-extrabold border border-bakery-border bg-bakery-card hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all text-bakery-muted cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                      <div className="pt-1">
                        <input
                          type="text"
                          placeholder="Card Terminal Reference ID (Optional)"
                          value={repayCardReference}
                          onChange={(e) => setRepayCardReference(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-bakery-border bg-bakery-background text-[10px] focus:outline-hidden focus:ring-1 focus:ring-bakery-orange text-black dark:text-white placeholder-bakery-muted/50"
                        />
                      </div>
                    </div>

                    {/* Split Totals Summary Box */}
                    {(() => {
                      const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                      const balanceDue = repaymentSale.totalAmount - totalPaid;
                      const allocatedSum = (parseFloat(repayCashAmount) || 0) + (parseFloat(repayUpiAmount) || 0) + (parseFloat(repayCardAmount) || 0);
                      const remBalance = balanceDue - allocatedSum;
                      const hasMismatch = balanceDue.toFixed(2) !== allocatedSum.toFixed(2);

                      return (
                        <div className={`p-3 rounded-xl border text-xs font-semibold space-y-1 mt-2 ${
                          hasMismatch
                            ? "bg-amber-500/10 border-bakery-gold/20 text-bakery-gold"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          <div className="flex justify-between">
                            <span>Balance Due:</span>
                            <span className="font-extrabold">{formatCurrency(balanceDue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Allocated:</span>
                            <span className="font-extrabold">{formatCurrency(allocatedSum)}</span>
                          </div>
                          <div className="flex justify-between border-t border-dashed border-bakery-border border-bakery-border pt-1 mt-1">
                            <span>Remaining to Allocate:</span>
                            <span className={`font-black ${remBalance > 0 ? "text-amber-600 dark:text-amber-400" : remBalance < 0 ? "text-rose-500" : ""}`}>
                              {formatCurrency(remBalance)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-bakery-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowRepaymentModal(false);
                    setRepaymentSale(null);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl text-bakery-foreground bg-bakery-background hover:bg-bakery-background/80 dark:text-bakery-muted-foreground dark:bg-gray-800 hover:bg-bakery-background font-bold text-center cursor-pointer transition-colors text-xs text-bakery-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeRepayment}
                  disabled={submitting || (
                    repayMethod === "SPLIT" &&
                    (() => {
                      const totalPaid = repaymentSale.payments?.reduce((acc: number, p: any) => acc + p.amount, 0) || 0;
                      const balanceDue = repaymentSale.totalAmount - totalPaid;
                      const allocatedSum = (parseFloat(repayCashAmount) || 0) + (parseFloat(repayUpiAmount) || 0) + (parseFloat(repayCardAmount) || 0);
                      return balanceDue.toFixed(2) !== allocatedSum.toFixed(2);
                    })()
                  )}
                  className="flex-1 py-3 px-4 rounded-xl text-white font-bold bg-gradient-to-r from-bakery-orange to-bakery-orange-dark disabled:opacity-50 disabled:pointer-events-none text-center cursor-pointer transition-colors text-xs shadow-md"
                >
                  {submitting ? "Processing..." : "Fulfill Balance"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
