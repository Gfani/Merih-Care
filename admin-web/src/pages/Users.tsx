import React, { useState, useEffect } from "react";
import { SearchBar, Select, Card, DataTable, Avatar, StatusBadge, Button, ConfirmDialog, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function UsersSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suspendModal, setSuspendModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const pts = await api.getUsers();
      const prs = await api.getProviders();
      setPatients(pts);
      setProviders(prs);
    } catch {
      toast("Failed to load users", "error");
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
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase());
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
            { key: "role", header: "Role", render: (row) => <span className="text-xs bg-[#f0f4f7] px-2 py-1 rounded-full font-medium">{row.role as string}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "phone", header: "Phone", render: (row) => <span className="text-[#8a9aaa] text-xs">{row.phone as string}</span> },
            { key: "memberSince", header: "Joined", render: (row) => <span className="text-xs text-[#8a9aaa]">{(row.memberSince as string) || (row.joinedDate as string)}</span> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2">View</Button>
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
    </div>
  );
}
