import React, { useState } from "react";
import { SearchBar, Button, Card, DataTable, Avatar, StatusBadge, Rating, toast } from "../components/ui";
import { providers as mockProviders } from "../data/mock";

interface ProvidersSectionProps {
  onVerification: () => void;
}

export default function ProvidersSection({ onVerification }: ProvidersSectionProps) {
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState(mockProviders);

  const filtered = providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggleSuspend = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "verified" : "suspended";
    setProviders(prev => prev.map(p => p.id === id ? { ...p, status: nextStatus as any } : p));
    toast(`Provider ${currentStatus === "suspended" ? "restored" : "suspended"}`, "info");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar placeholder="Search providers..." value={search} onChange={setSearch} className="flex-1 min-w-[200px]" />
        <Button variant="outline" size="sm" onClick={onVerification}>
          <span className="w-2 h-2 bg-[#d97706] rounded-full inline-block" />
          2 Pending Verifications
        </Button>
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "provider", header: "Provider", render: (row) => (
              <div className="flex items-center gap-2">
                <Avatar name={row.name as string} src={row.avatar as string} size="sm" />
                <div>
                  <p className="font-medium text-sm">{row.name as string}</p>
                  <p className="text-xs text-[#8a9aaa]">{row.title as string}</p>
                </div>
              </div>
            )},
            { key: "status", header: "Verification", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "rating", header: "Rating", render: (row) => <Rating value={row.rating as number} count={row.reviewCount as number} /> },
            { key: "experience", header: "Experience", render: (row) => <span className="text-sm">{row.experience as number}y</span> },
            { key: "completedServices", header: "Services", render: (row) => <span className="font-semibold text-[#0d7c6a]">{row.completedServices as number}</span> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2">View</Button>
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626] hover:!bg-[#fee2e2]" onClick={() => handleToggleSuspend(row.id as string, row.status as string)}>
                  {row.status === "suspended" ? "Restore" : "Suspend"}
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
