import React, { useState } from "react";
import { SearchBar, Select, Card, DataTable, StatusBadge } from "../components/ui";
import { appointments } from "../data/mock";

export default function RequestsSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredRequests = appointments.map(a => ({
    ...a,
    requestId: `REQ-${a.id.toUpperCase()}`
  })).filter(r => {
    const matchSearch = r.patientName.toLowerCase().includes(search.toLowerCase()) ||
                        r.service.toLowerCase().includes(search.toLowerCase()) ||
                        r.requestId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex gap-3 flex-wrap">
        <SearchBar placeholder="Search requests..." value={search} onChange={setSearch} className="flex-1 min-w-[200px]" />
        <Select label="" options={[
          { value: "all", label: "All Status" },
          { value: "pending", label: "Pending" },
          { value: "scheduled", label: "Scheduled" },
          { value: "in_progress", label: "In Progress" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40" />
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "requestId", header: "Request ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.requestId as string}</span> },
            { key: "patientName", header: "Patient" },
            { key: "service", header: "Service" },
            { key: "providerName", header: "Provider" },
            { key: "date", header: "Date", render: (row) => <span className="text-xs">{row.date as string} {row.time as string}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "amount", header: "Amount", render: (row) => <span className="font-semibold text-[#0d7c6a]">ETB {(row.amount as number).toLocaleString()}</span> },
          ]}
          data={filteredRequests as any}
        />
      </Card>
    </div>
  );
}
