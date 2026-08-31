import React, { useState, useEffect } from "react";
import { SearchBar, Select, Card, DataTable, Avatar, StatusBadge, Button, ConfirmDialog, Modal, Alert, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { Download, CheckSquare, Square, ShieldAlert, ShieldCheck } from "lucide-react";

export default function UsersSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  
  const [suspendModal, setSuspendModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionModal, setBulkActionModal] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<"active" | "suspended">("suspended");

  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Search debouncing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const pts = await api.getUsers();
      const prs = await api.getProviders();
      setPatients(Array.isArray(pts) ? pts : (pts as any)?.data || []);
      setProviders(Array.isArray(prs) ? prs : (prs as any)?.data || []);
    } catch (err: any) {
      setPatients([]);
      setProviders([]);
      setError(err.message || "Failed to load users. Backend API may be offline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allUsers = [
    ...(Array.isArray(patients) ? patients : []).map((p) => ({ ...p, role: "Patient" })),
    ...(Array.isArray(providers) ? providers : []).map((p) => ({ ...p, role: "Provider", status: p.status === "verified" ? "active" : p.status })),
  ].filter((u) => {
    const nameMatch = (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
                      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
                      (u.phone || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchRole = roleFilter === "all" || u.role.toLowerCase() === roleFilter.toLowerCase();
    return nameMatch && matchStatus && matchRole;
  });

  const totalPages = Math.ceil(allUsers.length / itemsPerPage) || 1;
  const paginatedUsers = allUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedUsers.map((u) => u.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleToggleSuspend = async () => {
    if (!selectedUser) return;
    const isSuspended = selectedUser.status === "suspended";

    try {
      await api.toggleUserSuspension(selectedUser.id, selectedUser.status);
      toast(`User ${isSuspended ? "restored" : "suspended"} successfully`, "info");
      loadData();
    } catch {
      toast("Action failed. Please check network connection.", "error");
    } finally {
      setSuspendModal(false);
    }
  };

  const handleBulkStatusChange = async () => {
    if (selectedIds.length === 0) return;
    try {
      await api.bulkUpdateUserStatus(selectedIds, bulkTargetStatus);
      toast(`Successfully updated ${selectedIds.length} users to ${bulkTargetStatus}`, "success");
      setSelectedIds([]);
      setBulkActionModal(false);
      loadData();
    } catch {
      toast("Bulk update failed.", "error");
    }
  };

  const exportCSV = () => {
    const headers = ["ID", "Name", "Email", "Phone", "Role", "Status", "Joined"];
    const rows = allUsers.map((u) => [
      u.id,
      `"${u.name || ""}"`,
      u.email || "",
      u.phone || "",
      u.role,
      u.status,
      u.memberSince || u.joinedDate || "",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `merihcare_users_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Users export downloaded", "success");
  };

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="error" title="Connection Error">
          {error}
        </Alert>
        <Button onClick={loadData}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <SearchBar
            placeholder="Search users..."
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-[200px]"
          />
          <Select
            label=""
            options={[
              { value: "all", label: "All Roles" },
              { value: "patient", label: "Patients" },
              { value: "provider", label: "Providers" },
            ]}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-32"
          />
          <Select
            label=""
            options={[
              { value: "all", label: "All Status" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-32"
          />
        </div>

        <Button variant="outline" onClick={exportCSV} className="flex items-center gap-2">
          <Download size={15} />
          <span>Export CSV</span>
        </Button>
      </div>

      {/* Bulk actions banner */}
      {selectedIds.length > 0 && (
        <div className="bg-[#e6f5f2] border border-[#0d7c6a]/30 rounded-[12px] p-3 flex items-center justify-between animate-fade-in">
          <span className="text-xs font-bold text-[#0a5c4e]">
            {selectedIds.length} user{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkTargetStatus("active");
                setBulkActionModal(true);
              }}
              className="flex items-center gap-1 text-xs"
            >
              <ShieldCheck size={14} />
              <span>Bulk Activate</span>
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                setBulkTargetStatus("suspended");
                setBulkActionModal(true);
              }}
              className="flex items-center gap-1 text-xs"
            >
              <ShieldAlert size={14} />
              <span>Bulk Suspend</span>
            </Button>
          </div>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: "select",
                  header: (
                    <button onClick={toggleSelectAll} className="cursor-pointer">
                      {selectedIds.length === paginatedUsers.length && paginatedUsers.length > 0 ? (
                        <CheckSquare size={16} className="text-[#0d7c6a]" />
                      ) : (
                        <Square size={16} className="text-[#8a9aaa]" />
                      )}
                    </button>
                  ) as any,
                  render: (row) => (
                    <button onClick={() => toggleSelectOne(row.id as string)} className="cursor-pointer">
                      {selectedIds.includes(row.id as string) ? (
                        <CheckSquare size={16} className="text-[#0d7c6a]" />
                      ) : (
                        <Square size={16} className="text-[#8a9aaa]" />
                      )}
                    </button>
                  ),
                },
                {
                  key: "user",
                  header: "User",
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <Avatar name={row.name as string} src={row.avatar as string} size="sm" />
                      <div>
                        <span className="font-medium text-xs block text-[#18232e] dark:text-white">{row.name as string}</span>
                        <span className="text-[10px] text-[#8a9aaa] block">{row.email as string}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "role",
                  header: "Role",
                  render: (row) => (
                    <span className="text-xs bg-[#f0f4f7] dark:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
                      {row.role as string}
                    </span>
                  ),
                },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
                { key: "phone", header: "Phone", render: (row) => <span className="text-[#8a9aaa] text-xs">{row.phone as string}</span> },
                {
                  key: "memberSince",
                  header: "Joined",
                  render: (row) => (
                    <span className="text-xs text-[#8a9aaa]">
                      {(row.memberSince as string) || (row.joinedDate as string) || "2026-08"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row) => (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDetails(row);
                          setDetailsModal(true);
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant={row.status === "suspended" ? "outline" : "danger"}
                        onClick={() => {
                          setSelectedUser(row);
                          setSuspendModal(true);
                        }}
                      >
                        {row.status === "suspended" ? "Restore" : "Suspend"}
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={paginatedUsers}
            />

            {/* Pagination footer */}
            <div className="p-4 border-t border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between text-xs text-[#8a9aaa]">
              <span>
                Showing {paginatedUsers.length} of {allUsers.length} accounts
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 font-semibold text-[#18232e] dark:text-white">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Suspend Confirm Dialog */}
      <ConfirmDialog
        open={suspendModal}
        onClose={() => setSuspendModal(false)}
        onConfirm={handleToggleSuspend}
        title={selectedUser?.status === "suspended" ? "Restore User Account" : "Suspend User Account"}
        message={
          selectedUser?.status === "suspended"
            ? `Are you sure you want to restore access for ${selectedUser?.name}?`
            : `Are you sure you want to suspend ${selectedUser?.name}? They will immediately lose access to the platform.`
        }
        confirmLabel={selectedUser?.status === "suspended" ? "Restore" : "Suspend"}
        confirmVariant={selectedUser?.status === "suspended" ? "primary" : "danger"}
      />

      {/* Bulk Action Confirm Dialog */}
      <ConfirmDialog
        open={bulkActionModal}
        onClose={() => setBulkActionModal(false)}
        onConfirm={handleBulkStatusChange}
        title={`Bulk ${bulkTargetStatus === "active" ? "Activation" : "Suspension"}`}
        message={`Are you sure you want to set ${selectedIds.length} user accounts to ${bulkTargetStatus}?`}
        confirmLabel={`Proceed with ${bulkTargetStatus}`}
        confirmVariant={bulkTargetStatus === "active" ? "primary" : "danger"}
      />

      {/* User Details Modal */}
      <Modal open={detailsModal} onClose={() => setDetailsModal(false)} title="Account Profile">
        {selectedDetails && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={selectedDetails.name} src={selectedDetails.avatar} size="md" />
              <div>
                <p className="font-bold text-[#18232e] dark:text-white">{selectedDetails.name}</p>
                <p className="text-xs text-[#8a9aaa]">{selectedDetails.email || "No email registered"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#f8fafc] dark:bg-slate-700/50 p-3 rounded-lg">
              <div><span className="text-[#8a9aaa]">Role:</span> <strong className="text-[#18232e] dark:text-white">{selectedDetails.role}</strong></div>
              <div><span className="text-[#8a9aaa]">Status:</span> <strong className="text-[#18232e] dark:text-white">{selectedDetails.status}</strong></div>
              <div><span className="text-[#8a9aaa]">Phone:</span> <strong className="text-[#18232e] dark:text-white">{selectedDetails.phone || "N/A"}</strong></div>
              <div><span className="text-[#8a9aaa]">Location:</span> <strong className="text-[#18232e] dark:text-white">{selectedDetails.location || "Addis Ababa"}</strong></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
