import React, { useState } from "react";
import { SearchBar, Button, Card, DataTable, Avatar, StatusBadge, Rating, ConfirmDialog, Modal, toast } from "../components/ui";
import { providers as mockProviders } from "../data/mock";

interface ProvidersSectionProps {
  onVerification: () => void;
}

export default function ProvidersSection({ onVerification }: ProvidersSectionProps) {
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState(mockProviders);

  const [suspendModal, setSuspendModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  const filtered = providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const confirmToggleSuspend = () => {
    if (!selectedProvider) return;
    const currentStatus = selectedProvider.status;
    const nextStatus = currentStatus === "suspended" ? "verified" : "suspended";
    setProviders(prev => prev.map(p => p.id === selectedProvider.id ? { ...p, status: nextStatus as any } : p));
    toast(`Provider ${currentStatus === "suspended" ? "restored" : "suspended"}`, "info");
    setSuspendModal(false);
    setSelectedProvider(null);
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
                  <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{row.title as string}</p>
                </div>
              </div>
            )},
            { key: "status", header: "Verification", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "rating", header: "Rating", render: (row) => <Rating value={row.rating as number} count={row.reviewCount as number} /> },
            { key: "experience", header: "Experience", render: (row) => <span className="text-sm">{row.experience as number}y</span> },
            { key: "completedServices", header: "Services", render: (row) => <span className="font-semibold text-[#0d7c6a] dark:text-cyan-400">{row.completedServices as number}</span> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2" onClick={() => { setSelectedDetails(row); setDetailsModal(true); }}>View</Button>
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626] hover:!bg-[#fee2e2]" onClick={() => { setSelectedProvider(row); setSuspendModal(true); }}>
                  {row.status === "suspended" ? "Restore" : "Suspend"}
                </Button>
              </div>
            )},
          ]}
          data={filtered as any}
        />
      </Card>

      <ConfirmDialog
        open={suspendModal}
        onClose={() => setSuspendModal(false)}
        onConfirm={confirmToggleSuspend}
        title={selectedProvider?.status === "suspended" ? "Restore Provider" : "Suspend Provider"}
        message={`Are you sure you want to ${selectedProvider?.status === "suspended" ? "restore" : "suspend"} ${selectedProvider?.name}?`}
        confirmLabel={selectedProvider?.status === "suspended" ? "Restore" : "Suspend"}
        confirmVariant={selectedProvider?.status === "suspended" ? "success" : "danger"}
      />

      <Modal open={detailsModal} onClose={() => setDetailsModal(false)} title="Provider Details">
        {selectedDetails && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={selectedDetails.name} src={selectedDetails.avatar} size="lg" />
              <div>
                <h4 className="font-bold text-sm text-[#18232e] dark:text-white">{selectedDetails.name}</h4>
                <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{selectedDetails.title}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Verification Status</p>
                <StatusBadge status={selectedDetails.status} />
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Rating</p>
                <div className="flex items-center gap-1">
                  <Rating value={selectedDetails.rating} count={selectedDetails.reviewCount} />
                </div>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Experience</p>
                <p className="text-[#18232e] dark:text-slate-200">{selectedDetails.experience} years</p>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Completed Services</p>
                <p className="text-[#18232e] dark:text-slate-200 font-semibold text-[#0d7c6a] dark:text-cyan-400">{selectedDetails.completedServices}</p>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <Button size="sm" onClick={() => setDetailsModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
