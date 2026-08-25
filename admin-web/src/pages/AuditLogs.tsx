import React, { useState } from "react";
import { SearchBar, Card, DataTable } from "../components/ui";
import { auditLogs } from "../data/mock";

export default function AuditLogsSection() {
  const [search, setSearch] = useState("");

  const filtered = auditLogs.filter(l =>
    l.actor.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.resource.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <SearchBar placeholder="Search audit logs..." value={search} onChange={setSearch} />
      <Card>
        <DataTable
          columns={[
            { key: "id", header: "Log ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
            { key: "actor", header: "Actor" },
            { key: "action", header: "Action", render: (row) => <span className="font-medium">{row.action as string}</span> },
            { key: "resource", header: "Resource", render: (row) => <span className="text-xs text-[#4a5a6a]">{row.resource as string}</span> },
            { key: "timestamp", header: "Timestamp", render: (row) => <span className="text-xs text-[#8a9aaa] font-mono">{row.timestamp as string}</span> },
            { key: "status", header: "Status", render: (row) => (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.status === "success" ? "bg-[#dcfce7] text-[#166534]" : row.status === "warning" ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#fee2e2] text-[#991b1b]"}`}>
                {row.status as string}
              </span>
            )},
          ]}
          data={filtered as any}
        />
      </Card>
    </div>
  );
}
