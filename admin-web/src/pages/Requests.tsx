import React, { useState, useEffect } from "react";
import { SearchBar, Select, Card, DataTable, StatusBadge, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function RequestsSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments();
      setAppointments(data);
    } catch {
      console.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRequests = appointments.map(a => ({
    ...a,
    requestId: `REQ-${a.id.toUpperCase()}`
  })).filter(r => {
    const pName = r.patientName || "";
    const sName = r.service || "";
    const reqId = r.requestId || "";
    const matchSearch = pName.toLowerCase().includes(search.toLowerCase()) ||
                        sName.toLowerCase().includes(search.toLowerCase()) ||
                        reqId.toLowerCase().includes(search.toLowerCase());
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
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "requestId", header: "Request ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.requestId as string}</span> },
              { key: "patientName", header: "Patient" },
              { key: "service", header: "Service" },
              { key: "providerName", header: "Provider" },
              { key: "date", header: "Date", render: (row) => <span className="text-xs">{row.date as string} {row.time as string}</span> },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
              { key: "amount", header: "Amount", render: (row) => <span className="font-semibold text-[#0d7c6a] dark:text-cyan-400">ETB {(row.amount as number).toLocaleString()}</span> },
            ]}
            data={filteredRequests as any}
          />
        )}
      </Card>
    </div>
  );
}
