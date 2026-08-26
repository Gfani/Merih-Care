import React, { useState, useEffect } from "react";
import { SearchBar, Select, Card, DataTable, Avatar, StatusBadge, Button, ConfirmDialog, Modal, Alert, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function UsersSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suspendModal, setSuspendModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const pts = await api.getUsers();
      const prs = await api.getProviders();
      setPatients(pts);
      setProviders(prs);
    } catch (err: any) {
      setError(err.message || "Failed to load users. Backend API may be offline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allUsers = [
    ...patients.map(p => ({ ...p, role: "Patient" })),
    ...providers.map(p => ({ ...p, role: "Provider", status: p.status === "verified" ? "active" : p.status })),
  ].filter(u => {
    const nameMatch = u.name || "";
    const matchSearch = nameMatch.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleToggleSuspend = async () => {
    if (!selectedUser) return;
    const isSuspended = selectedUser.status === "suspended";

    try {
      if (selectedUser.role === "Patient") {
        await api.toggleUserSuspension(selectedUser.id, selectedUser.status);
      } else {
        await api.toggleProviderSuspension(selectedUser.id, selectedUser.status);
      }
      toast(`User ${isSuspended ? "restored" : "suspended"}`, "info");
      loadData();
    } catch {
      toast("Action failed", "error");
    } finally {
      setSuspendModal(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Connection Error">
          {error}
        </Alert>
        <Button onClick={loadData}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar placeholder="Search users..." value={search} onChange={setSearch} className="flex-1 min-w-[200px]" />
        <Select label="" options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-36" />
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
            { key: "user", header: "User", render: (row) => (
              <div className="flex items-center gap-2"><Avatar name={row.name as string} src={row.avatar as string} size="sm" /><span className="font-medium">{row.name as string}</span></div>
            )},
            { key: "role", header: "Role", render: (row) => <span className="text-xs bg-[#f0f4f7] dark:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 px-2 py-1 rounded-full font-medium">{row.role as string}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "phone", header: "Phone", render: (row) => <span className="text-[#8a9aaa] text-xs">{row.phone as string}</span> },
            { key: "memberSince", header: "Joined", render: (row) => <span className="text-xs text-[#8a9aaa]">{(row.memberSince as string) || (row.joinedDate as string)}</span> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2" onClick={() => { setSelectedDetails(row); setDetailsModal(true); }}>View</Button>
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626] hover:!bg-[#fee2e2]" onClick={() => { setSelectedUser(row); setSuspendModal(true); }}>
                  {row.status === "suspended" ? "Restore" : "Suspend"}
                </Button>
              </div>
            )},
          ]}
          data={allUsers as any}
        />
        )}
      </Card>

      <ConfirmDialog
        open={suspendModal}
        onClose={() => setSuspendModal(false)}
        onConfirm={handleToggleSuspend}
        title={selectedUser?.status === "suspended" ? "Restore User" : "Suspend User"}
        message={`Are you sure you want to ${selectedUser?.status === "suspended" ? "restore" : "suspend"} ${selectedUser?.name}?`}
        confirmLabel={selectedUser?.status === "suspended" ? "Restore" : "Suspend"}
        confirmVariant={selectedUser?.status === "suspended" ? "success" : "danger"}
      />

      <Modal open={detailsModal} onClose={() => setDetailsModal(false)} title="User Details">
        {selectedDetails && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={selectedDetails.name} src={selectedDetails.avatar} size="lg" />
              <div>
                <h4 className="font-bold text-sm text-[#18232e] dark:text-white">{selectedDetails.name}</h4>
                <span className="text-xs bg-[#f0f4f7] dark:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 px-2 py-0.5 rounded-full font-medium mt-1 inline-block">{selectedDetails.role}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Email</p>
                <p className="text-[#18232e] dark:text-slate-200 truncate">{selectedDetails.email || "N/A"}</p>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Phone</p>
                <p className="text-[#18232e] dark:text-slate-200">{selectedDetails.phone || "N/A"}</p>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Status</p>
                <StatusBadge status={selectedDetails.status as any} />
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Joined</p>
                <p className="text-[#18232e] dark:text-slate-200">{selectedDetails.memberSince || selectedDetails.joinedDate || "N/A"}</p>
              </div>
            </div>
            {selectedDetails.role === "Provider" && (
              <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
                <div>
                  <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Experience</p>
                  <p className="text-[#18232e] dark:text-slate-200">{selectedDetails.experience} years</p>
                </div>
                <div>
                  <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Rating</p>
                  <p className="text-[#18232e] dark:text-slate-200">⭐ {selectedDetails.rating || "N/A"} ({selectedDetails.reviewCount || 0} reviews)</p>
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <Button size="sm" onClick={() => setDetailsModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
