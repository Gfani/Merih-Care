import React, { useState } from "react";
import { SearchBar, Button, Card, DataTable, StatusBadge, toast } from "../components/ui";
import { serviceCategories as mockCategories } from "../data/mock";

export default function ServicesSection() {
  const [search, setSearch] = useState("");
  const [services, setServices] = useState(() =>
    mockCategories.map(s => ({ ...s, status: "active" as "active" | "closed" }))
  );

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggleActive = (id: string, currentStatus: "active" | "closed") => {
    const nextStatus = currentStatus === "active" ? "closed" : "active";
    setServices(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    toast(`Service category ${currentStatus === "active" ? "deactivated" : "activated"}`, "info");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar placeholder="Search services..." value={search} onChange={setSearch} className="flex-1 min-w-[200px]" />
        <Button size="sm">+ Add Service</Button>
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "service", header: "Service", render: (row) => (
              <div className="flex items-center gap-2">
                <span className="text-lg">{row.icon as string}</span>
                <div>
                  <p className="font-medium text-sm">{row.name as string}</p>
                  <p className="text-xs text-[#8a9aaa]">{row.description as string}</p>
                </div>
              </div>
            )},
            { key: "priceFrom", header: "Price from", render: (row) => <span className="font-semibold text-[#0d7c6a]">ETB {(row.priceFrom as number).toLocaleString()}</span> },
            { key: "providerCount", header: "Providers", render: (row) => <span className="font-semibold">{row.providerCount as number}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2">Edit</Button>
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626]" onClick={() => handleToggleActive(row.id as string, row.status as "active" | "closed")}>
                  {(row.status as "active" | "closed") === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            )},
          ]}
          data={filtered as any}
        />
      </Card>
    </div>
  );
}
