import React, { useState, useEffect } from "react";
import { SearchBar, Button, Card, DataTable, Avatar, StatusBadge, Rating, ConfirmDialog, Modal, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { AlertTriangle } from "lucide-react";

interface ProvidersSectionProps {
  onVerification: () => void;
}

export default function ProvidersSection({ onVerification }: ProvidersSectionProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [suspendModal, setSuspendModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  // Permission awareness details
  const adminUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
  const userRole = adminUser.role || "";
  const userPermissions = adminUser.permissions || [];
  const canModifyProviders = userRole === "super_admin" || userPermissions.includes("edit:providers") || userPermissions.includes("admin:providers");

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProviders();
      setProviders(data);
      setLastUpdated(new Date());
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to load providers from API.");
      // Check session expiration / 401 Unauthorized
      if (err.response?.status === 401) {
        api.logout();
        toast("Session expired. Please log in again.", "error");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const confirmToggleSuspend = async () => {
    if (!selectedProvider) return;
    try {
      const currentStatus = selectedProvider.status;
      await api.toggleProviderSuspension(selectedProvider.id, currentStatus);
      toast(`Provider ${currentStatus === "suspended" ? "restored" : "suspended"} successfully.`, "success");
      loadProviders();
    } catch (err: any) {
      toast(err.message || "Failed to update provider status.", "error");
    } finally {
      setSuspendModal(false);
      setSelectedProvider(null);
    }
  };

  const handleBulkSuspend = async () => {
    if (!canModifyProviders) {
      toast("Permission denied.", "error");
      return;
    }
    try {
      setLoading(true);
      // Process sequential suspend requests
      for (const id of selectedIds) {
        const prov = providers.find(p => p.id === id);
        if (prov) {
          await api.toggleProviderSuspension(id, prov.status);
        }
      }
      toast(`Bulk status updates processed successfully.`, "success");
      loadProviders();
    } catch (err: any) {
      toast(err.message || "Error during bulk updates.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Filter & Sort Logic
  const filtered = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.title && p.title.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" ? true : p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "experience") return (b.experience || 0) - (a.experience || 0);
    if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "completedServices") return (b.completedServices || 0) - (a.completedServices || 0);
    return 0;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Stale warning logic (warning if data last updated > 5 min ago)
  const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchBar placeholder="Search providers..." value={search} onChange={(val) => { setSearch(val); setCurrentPage(1); }} className="flex-1 min-w-[200px]" />
        
        <div className="flex gap-2 items-center flex-wrap">
          {/* Status Filter */}
          <select 
            value={statusFilter} 
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Verification Statuses</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Sort Selection */}
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="name">Sort by Name</option>
            <option value="experience">Sort by Experience</option>
            <option value="rating">Sort by Rating</option>
            <option value="completedServices">Sort by Services</option>
          </select>

          <Button variant="outline" size="sm" onClick={onVerification} className="cursor-pointer">
            <span className="w-2 h-2 bg-[#d97706] rounded-full inline-block mr-1.5 animate-pulse" />
            Verification Queue
          </Button>
        </div>
      </div>

      {/* Stale data warning */}
      {isStale && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-xs rounded-[8px] flex justify-between items-center">
          <span className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" aria-hidden="true" />
            <span>Stale Data Warning: Providers details were fetched more than 5 minutes ago.</span>
          </span>
          <Button size="sm" variant="ghost" onClick={loadProviders} className="!py-0.5 !px-2 text-amber-900 font-bold hover:bg-amber-100">Refresh</Button>
        </div>
      )}

      {/* Last Updated Timestamp */}
      <div className="text-[10px] text-[#8a9aaa] flex justify-between items-center px-1">
        <span>Last Sync: {lastUpdated.toLocaleTimeString()}</span>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#18232e] dark:text-slate-300">{selectedIds.size} selected</span>
            <Button size="sm" variant="danger" disabled={!canModifyProviders} onClick={handleBulkSuspend} className="!py-0.5 !px-2 text-[10px]">
              Bulk Toggle Suspend
            </Button>
          </div>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-500 font-semibold flex items-center justify-center gap-1.5">
              <AlertTriangle size={16} className="text-red-500 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
            <Button size="sm" onClick={loadProviders} className="cursor-pointer">Retry Loading</Button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#8a9aaa]">
            No providers found matching current search and filters.
          </div>
        ) : (
          <div>
            <DataTable
              columns={[
                { 
                  key: "select", 
                  header: <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded" />,
                  render: (row) => <input type="checkbox" checked={selectedIds.has(row.id as string)} onChange={() => toggleSelect(row.id as string)} className="rounded" />
                },
                { key: "provider", header: "Provider", render: (row) => (
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name as string} src={row.avatar as string} size="sm" />
                    <div>
                      <p className="font-medium text-sm text-[#18232e] dark:text-white">{row.name as string}</p>
                      <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{(row.title as string) || "Health Professional"}</p>
                    </div>
                  </div>
                )},
                { key: "status", header: "Verification", render: (row) => <StatusBadge status={row.status as any} /> },
                { key: "rating", header: "Rating", render: (row) => <Rating value={row.rating as number || 5.0} count={row.reviewCount as number || 0} /> },
                { key: "experience", header: "Experience", render: (row) => <span className="text-sm">{row.experience as number || 0}y</span> },
                { key: "completedServices", header: "Services", render: (row) => <span className="font-semibold text-[#0d7c6a] dark:text-cyan-400">{row.completedServices as number || 0}</span> },
                { key: "actions", header: "Actions", render: (row) => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 cursor-pointer" onClick={() => { setSelectedDetails(row); setDetailsModal(true); }}>View</Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      disabled={!canModifyProviders}
                      className="text-xs !py-1 !px-2 text-[#dc2626] hover:!bg-[#fee2e2] disabled:opacity-50 cursor-pointer" 
                      onClick={() => { setSelectedProvider(row); setSuspendModal(true); }}
                      title={!canModifyProviders ? "Requires edit:providers permission" : ""}
                    >
                      {row.status === "suspended" ? "Restore" : "Suspend"}
                    </Button>
                  </div>
                )},
              ]}
              data={paginated as any}
            />

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-[#f0f4f7] dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 text-xs">
              <span className="text-[#8a9aaa]">Page {currentPage} of {totalPages} ({sorted.length} total providers)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="cursor-pointer">Prev</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="cursor-pointer">Next</Button>
              </div>
            </div>
          </div>
        )}
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
                <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{selectedDetails.title || "Health Professional"}</p>
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
                  <Rating value={selectedDetails.rating || 5.0} count={selectedDetails.reviewCount || 0} />
                </div>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Experience</p>
                <p className="text-[#18232e] dark:text-slate-200">{selectedDetails.experience || 0} years</p>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px] mb-0.5">Completed Services</p>
                <p className="text-[#18232e] dark:text-slate-200 font-semibold text-[#0d7c6a] dark:text-cyan-400">{selectedDetails.completedServices || 0}</p>
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
