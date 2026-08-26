import React, { useState, useEffect } from "react";
import { SearchBar, Card, DataTable, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function AuditLogsSection() {
  const [search, setSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setAuditLogs(data);
    } catch {
      console.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = auditLogs.filter(l => {
    const actor = l.actor || "";
    const action = l.action || "";
    const res = l.resource || "";
    return actor.toLowerCase().includes(search.toLowerCase()) ||
      action.toLowerCase().includes(search.toLowerCase()) ||
      res.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <SearchBar placeholder="Search audit logs..." value={search} onChange={setSearch} />
      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "id", header: "Log ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
              { key: "actor", header: "Actor" },
              { key: "action", header: "Action", render: (row) => <span className="font-medium">{row.action as string}</span> },
              { key: "resource", header: "Resource", render: (row) => <span className="text-xs text-[#4a5a6a] dark:text-slate-300">{row.resource as string}</span> },
              { key: "timestamp", header: "Timestamp", render: (row) => <span className="text-xs text-[#8a9aaa] font-mono">{row.timestamp as string}</span> },
              { key: "status", header: "Status", render: (row) => (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.status === "success" ? "bg-[#dcfce7] text-[#166534]" : row.status === "warning" ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
                  {row.status as string}
                </span>
              )},
            ]}
            data={filtered as any}
          />
        )}
      </Card>
    </div>
  );
}
