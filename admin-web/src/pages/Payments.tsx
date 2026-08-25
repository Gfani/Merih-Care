import React, { useState } from "react";
import { StatCard, SearchBar, Card, DataTable, StatusBadge } from "../components/ui";
import { transactions } from "../data/mock";

export default function PaymentsSection() {
  const [search, setSearch] = useState("");

  const filtered = transactions.filter(t =>
    t.patientName.toLowerCase().includes(search.toLowerCase()) ||
    t.service.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: transactions.length,
    successful: transactions.filter(t => t.status === "successful").length,
    failed: transactions.filter(t => t.status === "failed").length,
    revenue: transactions.filter(t => t.status === "successful").reduce((sum, t) => sum + t.amount, 0)
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Transactions" value={stats.total} />
        <StatCard label="Successful" value={stats.successful} color="#16a34a" />
        <StatCard label="Failed" value={stats.failed} color="#dc2626" />
        <StatCard label="Revenue" value={`ETB ${stats.revenue.toLocaleString()}`} color="#1b6fba" />
      </div>
      <div className="flex gap-3">
        <SearchBar placeholder="Search transactions..." value={search} onChange={setSearch} className="flex-1" />
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "id", header: "Transaction ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
            { key: "patientName", header: "Patient" },
            { key: "providerName", header: "Provider" },
            { key: "service", header: "Service" },
            { key: "amount", header: "Amount", render: (row) => <span className="font-semibold">ETB {(row.amount as number).toLocaleString()}</span> },
            { key: "method", header: "Method", render: (row) => <span className="text-xs bg-[#f0f4f7] px-2 py-1 rounded-full">{row.method as string}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "date", header: "Date", render: (row) => <span className="text-xs text-[#8a9aaa]">{row.date as string}</span> },
          ]}
          data={filtered as any}
        />
      </Card>
    </div>
  );
}
