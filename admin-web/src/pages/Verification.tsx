import React, { useState, useEffect } from "react";
import { Alert, Card, Avatar, StatusBadge, Button, DataTable, ConfirmDialog, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function VerificationSection() {
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [approveModal, setApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);

  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await api.getProviders();
      setProviders(data);
    } catch {
      toast("Failed to load verification queue", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pending = providers.filter(p => !p.verified);

  const handleApprove = async () => {
    if (!selectedProvider) return;
    try {
      await api.approveProvider(selectedProvider.id);
      toast(`${selectedProvider?.name} has been verified!`, "success");
      loadData();
    } catch {
      toast("Failed to approve provider", "error");
    } finally {
      setApproveModal(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProvider) return;
    try {
      await api.rejectProvider(selectedProvider.id);
      toast(`Verification rejected for ${selectedProvider?.name}`, "warning");
      loadData();
    } catch {
      toast("Failed to reject provider", "error");
    } finally {
      setRejectModal(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {pending.length > 0 ? (
        <Alert variant="warning" title={`${pending.length} verifications pending`}>
          Review submitted credentials carefully before approving provider accounts.
        </Alert>
      ) : (
        <Alert variant="success" title="No verifications pending">
          All submitted provider credentials have been processed.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          pending.map(provider => (
            <Card key={provider.id} className="p-5">
            <div className="flex items-start gap-3 mb-4 pb-4 border-b border-[#f0f4f7]">
              <Avatar src={provider.avatar} name={provider.name} size="lg" />
              <div className="flex-1">
                <p className="font-semibold text-[#18232e]">{provider.name}</p>
                <p className="text-sm text-[#8a9aaa]">{provider.title}</p>
                <StatusBadge status="pending" />
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wide">Submitted Documents</p>
              {["Professional License", "National ID", "Academic Certificate", "Police Clearance"].map(doc => (
                <div key={doc} className="flex items-center justify-between text-sm py-1.5 border-b border-[#f0f4f7] last:border-0">
                  <span className="text-[#4a5a6a]">{doc}</span>
                  <div className="flex items-center gap-2">
                    <button className="text-xs text-[#1b6fba] font-semibold hover:underline">View</button>
                    <StatusBadge status="pending" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" className="flex-1" onClick={() => { setSelectedProvider(provider); setRejectModal(true); }}>Reject</Button>
              <Button variant="outline" size="sm" className="flex-1">Request Fix</Button>
              <Button size="sm" className="flex-1" onClick={() => { setSelectedProvider(provider); setApproveModal(true); }}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3 3.5L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Approve
              </Button>
            </div>
          </Card>
        )))}
      </div>

      <Card>
        <div className="p-4 border-b border-[#e2e8ee]">
          <p className="text-sm font-semibold text-[#18232e]">All Provider Verifications</p>
        </div>
        {loading ? (
          <div className="p-6"><SkeletonCard /></div>
        ) : (
          <DataTable
            columns={[
              { key: "provider", header: "Provider", render: (row) => (
                <div className="flex items-center gap-2"><Avatar name={row.name as string} src={row.avatar as string} size="sm" /><span className="font-medium text-sm">{row.name as string}</span></div>
              )},
              { key: "title", header: "Profession" },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
              { key: "joinedDate", header: "Submitted", render: (row) => <span className="text-xs text-[#8a9aaa]">{row.joinedDate as string}</span> },
              { key: "actions", header: "Actions", render: () => (
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2">Review</Button>
              )},
            ]}
            data={providers as any}
          />
        )}
      </Card>

      <ConfirmDialog open={approveModal} onClose={() => setApproveModal(false)} onConfirm={handleApprove} title="Approve Provider" message={`You are approving ${selectedProvider?.name} as a verified Merihcare provider. They will be able to accept service requests immediately.`} confirmLabel="Approve" confirmVariant="success" />
      <ConfirmDialog open={rejectModal} onClose={() => setRejectModal(false)} onConfirm={handleReject} title="Reject Verification" message={`You are rejecting the verification for ${selectedProvider?.name}. Please ensure you have reviewed all submitted documents carefully.`} confirmLabel="Reject" confirmVariant="danger" />
    </div>
  );
}
