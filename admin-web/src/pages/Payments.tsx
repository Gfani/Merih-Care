import React, { useState, useEffect } from "react";
import { StatCard, SearchBar, Card, DataTable, StatusBadge, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function PaymentsSection() {
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getPayments();
      setTransactions(data);
    } catch {
      console.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = transactions.filter(t => {
    const pName = t.patientName || "";
    const sName = t.service || "";
    const txId = t.id || "";
    return pName.toLowerCase().includes(search.toLowerCase()) ||
      sName.toLowerCase().includes(search.toLowerCase()) ||
      txId.toLowerCase().includes(search.toLowerCase());
  });

  const stats = {
    total: transactions.length,
    successful: transactions.filter(t => t.status === "successful").length,
    failed: transactions.filter(t => t.status === "failed").length,
    revenue: transactions.filter(t => t.status === "successful").reduce((sum, t) => sum + t.amount, 0)
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Transactions" value={loading ? "..." : stats.total} />
        <StatCard label="Successful" value={loading ? "..." : stats.successful} color="#16a34a" />
        <StatCard label="Failed" value={loading ? "..." : stats.failed} color="#dc2626" />
        <StatCard label="Revenue" value={loading ? "..." : `ETB ${stats.revenue.toLocaleString()}`} color="#1b6fba" />
      </div>
      <div className="flex gap-3">
        <SearchBar placeholder="Search transactions..." value={search} onChange={setSearch} className="flex-1" />
      </div>
      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "id", header: "Transaction ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
              { key: "patientName", header: "Patient" },
              { key: "providerName", header: "Provider" },
              { key: "service", header: "Service" },
              { key: "amount", header: "Amount", render: (row) => <span className="font-semibold">ETB {(row.amount as number).toLocaleString()}</span> },
              { key: "method", header: "Method", render: (row) => <span className="text-xs bg-[#f0f4f7] dark:bg-slate-700 px-2 py-1 rounded-full">{row.method as string}</span> },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
              { key: "date", header: "Date", render: (row) => <span className="text-xs text-[#8a9aaa] dark:text-slate-400">{row.date as string}</span> },
            ]}
            data={filtered as any}
          />
        )}
      </Card>
    </div>
  );
}
