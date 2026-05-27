"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/ToastProvider";
import { 
  TrendingUp, ShoppingBag, Calendar, AlertTriangle, 
  ArrowUpRight, FileText, CheckCircle, Loader2, RefreshCw
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  Tooltip, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Summary {
  totalToday: number;
  countToday: number;
  totalMonth: number;
  cashToday: number;
  upiToday: number;
  cardToday: number;
  cashMonth: number;
  upiMonth: number;
  cardMonth: number;
  splitCountToday: number;
}

interface LowStockAlert {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  category: string;
}

interface BestSeller {
  name: string;
  quantitySold: number;
  revenue: number;
}

interface Transaction {
  id: string;
  transactionId: string;
  totalAmount: number;
  staffName: string;
  createdAt: string;
}

interface GraphData {
  date: string;
  revenue: number;
}

interface CategoryAnalytic {
  name: string;
  revenue: number;
  quantitySold: number;
  itemCount: number;
}

export default function DashboardPage() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary>({
    totalToday: 0,
    countToday: 0,
    totalMonth: 0,
    cashToday: 0,
    upiToday: 0,
    cardToday: 0,
    cashMonth: 0,
    upiMonth: 0,
    cardMonth: 0,
    splitCountToday: 0,
  });
  const [lowStock, setLowStock] = useState<LowStockAlert[]>([]);
  const [bestSellers, setBestSellers] = useState<BestSeller[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [graphData, setGraphData] = useState<GraphData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryAnalytic[]>([]);

  // Stock Adjustment Modal States (for quick restock)
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState<{ id: string; name: string; stock: number } | null>(null);
  const [stockAdjustment, setStockAdjustment] = useState("");
  const [stockNotes, setStockNotes] = useState("");

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setLowStock(data.lowStockAlerts);
        setBestSellers(data.bestSellers);
        setTransactions(data.recentTransactions);
        setGraphData(data.dailyRevenueGraph);
        setCategoryData(data.categoryAnalytics);
      } else {
        showToast("Failed to fetch dashboard metrics.", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Network error. Failed to load dashboard.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Open Quick Restock Modal
  const openQuickRestock = (item: LowStockAlert) => {
    setSelectedStockItem({
      id: item.id,
      name: item.name,
      stock: item.stock
    });
    setStockAdjustment("");
    setStockNotes("");
    setShowStockModal(true);
  };

  // Submit Quick Restock Adjustment
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockItem || !stockAdjustment) return;

    const val = parseInt(stockAdjustment);
    if (isNaN(val) || val <= 0) {
      showToast("Please enter a valid positive stock quantity to restock.", "error");
      return;
    }

    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedStockItem.id,
          changeQty: val,
          notes: stockNotes.trim() || "Quick dashboard replenishment restock",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(`Replenished ${selectedStockItem.name} successfully.`, "success");
        setShowStockModal(false);
        loadDashboardData(); // Reload analytics
      } else {
        showToast(data.error || "Restock failed.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    }
  };

  // Pie chart colors
  const COLORS = ["#F47A1F", "#D4AF37", "#8C6239", "#d35a00", "#ebd9c8", "#1E130F"];

  return (
    <div className="flex flex-col min-h-screen bg-bakery-background text-bakery-foreground">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header section */}
        <div className="flex items-center justify-between border-b border-bakery-border pb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-bakery-foreground">Bakery Overview & Analytics</h1>
            <p className="text-xs text-bakery-muted">Live sales trends and inventory health.</p>
          </div>
          <button
            onClick={loadDashboardData}
            className="p-2 border border-bakery-border rounded-lg hover:bg-bakery-cream dark:hover:bg-bakery-dark transition-all cursor-pointer text-bakery-muted hover:text-bakery-orange"
            title="Refresh statistics"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-3">
            <Loader2 className="w-12 h-12 text-bakery-gold animate-spin" />
            <p className="text-sm text-bakery-muted">Compiling dashboard analytics...</p>
          </div>
        ) : (
          <>
            {/* Top Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Revenue Today */}
              <div className="bg-bakery-card p-5 rounded-xl border border-bakery-border shadow-xs flex items-center justify-between">
                <div className="space-y-1 w-full">
                  <span className="text-xs text-bakery-muted font-bold uppercase tracking-wider">Revenue Today</span>
                  <h3 className="text-2xl font-extrabold text-bakery-warm dark:text-bakery-gold">{formatCurrency(summary.totalToday)}</h3>
                  <div className="text-[9px] font-bold text-bakery-muted flex flex-wrap gap-x-2 pt-1 border-t border-bakery-border mt-1">
                    <span className="text-bakery-orange">Cash: {formatCurrency(summary.cashToday, false)}</span>
                    <span className="text-bakery-gold">UPI: {formatCurrency(summary.upiToday, false)}</span>
                    <span className="text-bakery-warm">Card: {formatCurrency(summary.cardToday, false)}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Transactions Today */}
              <div className="bg-bakery-card p-5 rounded-xl border border-bakery-border shadow-xs flex items-center justify-between">
                <div className="space-y-1 w-full">
                  <span className="text-xs text-bakery-muted font-bold uppercase tracking-wider">Transactions Today</span>
                  <h3 className="text-2xl font-extrabold">{summary.countToday}</h3>
                  <div className="text-[9px] font-bold text-bakery-muted flex justify-between pt-1 border-t border-bakery-border mt-1">
                    <span>Split checkouts today:</span>
                    <span className="text-bakery-gold">{summary.splitCountToday}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Monthly Revenue */}
              <div className="bg-bakery-card p-5 rounded-xl border border-bakery-border shadow-xs flex items-center justify-between">
                <div className="space-y-1 w-full">
                  <span className="text-xs text-bakery-muted font-bold uppercase tracking-wider">Revenue This Month</span>
                  <h3 className="text-2xl font-extrabold text-bakery-warm dark:text-bakery-gold">{formatCurrency(summary.totalMonth)}</h3>
                  <div className="text-[9px] font-bold text-bakery-muted flex flex-wrap gap-x-2 pt-1 border-t border-bakery-border mt-1">
                    <span className="text-bakery-orange">Cash: {formatCurrency(summary.cashMonth, false)}</span>
                    <span className="text-bakery-gold">UPI: {formatCurrency(summary.upiMonth, false)}</span>
                    <span className="text-bakery-warm">Card: {formatCurrency(summary.cardMonth, false)}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Low Stock Warnings */}
              <div className="bg-bakery-card p-5 rounded-xl border border-bakery-border shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs text-bakery-muted font-bold uppercase tracking-wider">Inventory Alerts</span>
                  <h3 className={`text-2xl font-extrabold ${lowStock.length > 0 ? "text-rose-500 animate-pulse font-black" : "text-emerald-500"}`}>
                    {lowStock.length} {lowStock.length > 0 ? "Alerts" : "Healthy"}
                  </h3>
                  <p className="text-[10px] text-bakery-muted">Items below threshold</p>
                </div>
                <div className={`p-3 rounded-lg ${lowStock.length > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Daily Revenue & Payment Modes chart (8 cols) */}
              <div className="lg:col-span-8 bg-bakery-card border border-bakery-border p-5 rounded-xl shadow-xs">
                <h3 className="text-sm font-bold text-bakery-muted uppercase tracking-wider mb-4">30-Day Payment Modes Breakdown</h3>
                <div className="h-72 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={graphData}>
                      <XAxis dataKey="date" stroke="#866850" />
                      <YAxis stroke="#866850" tickFormatter={(val) => formatCurrency(val, false)} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--card)", 
                          borderRadius: "8px", 
                          border: "1px solid var(--border)",
                          color: "var(--foreground)" 
                        }} 
                        formatter={(value: any) => value !== undefined ? formatCurrency(Number(value)) : ""}
                      />
                      <Bar dataKey="cash" stackId="a" fill="#F47A1F" name="Cash" />
                      <Bar dataKey="upi" stackId="a" fill="#D4AF37" name="UPI" />
                      <Bar dataKey="card" stackId="a" fill="#8C6239" name="Card" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Category & Payment Mode breakdown (4 cols) */}
              <div className="lg:col-span-4 bg-bakery-card border border-bakery-border p-5 rounded-xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex border-b border-bakery-border mb-3 pb-1 gap-4">
                    <h3 className="text-xs font-bold text-bakery-muted uppercase tracking-wider">Top Categories</h3>
                  </div>
                  <div className="space-y-3 mb-4">
                    {categoryData.slice(0, 3).map((cat, index) => {
                      const maxVal = categoryData[0]?.revenue || 1;
                      const percentage = (cat.revenue / maxVal) * 100;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>{cat.name}</span>
                            <span className="font-extrabold text-bakery-warm dark:text-bakery-gold">{formatCurrency(cat.revenue)}</span>
                          </div>
                          <div className="w-full bg-bakery-background h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full" 
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-bakery-border pt-3">
                    <h3 className="text-xs font-bold text-bakery-muted uppercase tracking-wider mb-2">Today's Payment Share</h3>
                    <div className="h-32 w-full text-xs font-semibold flex items-center justify-center">
                      {summary.totalToday === 0 ? (
                        <span className="text-bakery-muted text-[10px]">No payment share data for today</span>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Cash", value: summary.cashToday },
                                { name: "UPI", value: summary.upiToday },
                                { name: "Card", value: summary.cardToday }
                              ].filter(v => v.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={25}
                              outerRadius={45}
                              paddingAngle={3}
                              dataKey="value"
                            >
                               <Cell fill="#F47A1F" />
                              <Cell fill="#D4AF37" />
                              <Cell fill="#8C6239" />
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "var(--card)", 
                                borderRadius: "8px", 
                                border: "1px solid var(--border)",
                                color: "var(--foreground)" 
                              }}
                              formatter={(value: any) => value !== undefined ? formatCurrency(Number(value)) : ""} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="flex justify-center gap-4 text-[9px] font-bold text-bakery-muted mt-1">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bakery-orange inline-block"></span> Cash</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bakery-gold inline-block"></span> UPI</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bakery-warm inline-block"></span> Card</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-bakery-border pt-3 mt-3 flex items-center justify-between text-[10px] text-bakery-muted">
                  <span>Sales volumes breakdown</span>
                  <span className="font-bold text-bakery-warm">Live</span>
                </div>
              </div>
            </div>

            {/* Bottom section: best sellers, recent tx, low stock alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: Best-Selling Items */}
              <div className="bg-bakery-card border border-bakery-border p-5 rounded-xl shadow-xs flex flex-col">
                <h3 className="text-sm font-bold text-bakery-muted uppercase tracking-wider mb-4 border-b border-bakery-border pb-2 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Best Sellers
                </h3>
                <div className="flex-1 space-y-3.5">
                  {bestSellers.length === 0 ? (
                    <p className="text-bakery-muted text-center py-12 text-xs">No products sold yet.</p>
                  ) : (
                    bestSellers.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between gap-2 border-b border-bakery-border/40 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold px-2 py-0.5 bg-bakery-cream dark:bg-bakery-dark rounded-md text-bakery-warm">
                            #{index + 1}
                          </span>
                          <span className="text-xs font-bold leading-tight line-clamp-1">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-extrabold block text-bakery-warm dark:text-bakery-gold">{formatCurrency(item.revenue)}</span>
                          <span className="text-[10px] text-bakery-muted font-semibold">{item.quantitySold} units sold</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: Recent Transactions */}
              <div className="bg-bakery-card border border-bakery-border p-5 rounded-xl shadow-xs flex flex-col">
                <h3 className="text-sm font-bold text-bakery-muted uppercase tracking-wider mb-4 border-b border-bakery-border pb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-bakery-warm" /> Recent Sales
                </h3>
                <div className="flex-1 space-y-3.5">
                  {transactions.length === 0 ? (
                    <p className="text-bakery-muted text-center py-12 text-xs">No sales recorded today.</p>
                  ) : (
                    transactions.slice(0, 5).map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between border-b border-bakery-border/40 pb-2 text-xs">
                        <div>
                          <span className="font-bold text-bakery-foreground block">{sale.transactionId}</span>
                          <span className="text-[10px] text-bakery-muted">{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <span className="font-extrabold text-sm text-bakery-warm dark:text-bakery-gold">
                          {formatCurrency(sale.totalAmount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 3: Stock Alert & Quick Restock */}
              <div className="bg-bakery-card border border-bakery-border p-5 rounded-xl shadow-xs flex flex-col">
                <h3 className="text-sm font-bold text-bakery-muted uppercase tracking-wider mb-4 border-b border-bakery-border pb-2 flex items-center gap-2 text-rose-500">
                  <AlertTriangle className="w-4 h-4 animate-pulse" /> Critical Stock Alerts
                </h3>
                <div className="flex-1 space-y-3.5">
                  {lowStock.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-emerald-500 text-center gap-1">
                      <CheckCircle className="w-8 h-8" />
                      <p className="text-xs font-bold">All stock levels healthy!</p>
                    </div>
                  ) : (
                    lowStock.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between border-b border-bakery-border/40 pb-2">
                        <div>
                          <span className="text-xs font-bold leading-tight block line-clamp-1">{item.name}</span>
                          <span className="text-[10px] text-rose-500 font-bold">Only {item.stock} left in stock</span>
                        </div>
                        <button
                          onClick={() => openQuickRestock(item)}
                          className="px-2 py-1 rounded-md border border-bakery-gold hover:bg-bakery-gold text-bakery-gold hover:text-white dark:hover:text-black text-[10px] font-extrabold transition-all cursor-pointer"
                        >
                          Quick Restock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Quick Restock Modal */}
      {showStockModal && selectedStockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-bakery-card border border-bakery-border rounded-2xl max-w-md w-full shadow-2xl p-6 relative text-bakery-foreground">
            <h2 className="text-lg font-bold border-b border-bakery-border pb-3 mb-2">
              Quick Stock Replenishment
            </h2>
            <p className="text-xs text-bakery-muted mb-4">
              Restocking: <strong>{selectedStockItem.name}</strong>. Current level: <strong>{selectedStockItem.stock}</strong>.
            </p>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">
                  Restock Quantity (Positive number) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="E.g. 50"
                  value={stockAdjustment}
                  onChange={(e) => setStockAdjustment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-gold font-bold text-bakery-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bakery-muted uppercase mb-1">Stock Log Details</label>
                <input
                  type="text"
                  placeholder="E.g. Standard bakery replenishment delivery"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-bakery-border bg-bakery-background focus:outline-hidden focus:ring-2 focus:ring-bakery-gold text-xs text-bakery-foreground"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-bakery-border">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-bakery-background hover:bg-bakery-background/90 text-bakery-foreground border border-bakery-border cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-bakery-orange hover:bg-bakery-orange-dark cursor-pointer"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
