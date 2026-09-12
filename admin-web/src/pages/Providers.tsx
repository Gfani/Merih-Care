import React, { useState, useEffect } from "react";
import { SearchBar, Button, Card, DataTable, Avatar, StatusBadge, Rating, ConfirmDialog, Modal, toast, SkeletonCard, Input } from "../components/ui";
import { api } from "../services/api";
import { AlertTriangle, MessageSquare, Phone, Mail, Send, Trash2 } from "lucide-react";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";

interface ProvidersSectionProps {
  onVerification?: () => void;
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
  const [deleteModal, setDeleteModal] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<any>(null);
  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  // Contact Provider state
  const [contactModal, setContactModal] = useState(false);
  const [providerToContact, setProviderToContact] = useState<any>(null);
  const [contactTitle, setContactTitle] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactPriority, setContactPriority] = useState<"normal" | "urgent">("normal");
  const [sendingContact, setSendingContact] = useState(false);

  // Permission awareness details
  const getAdminUser = () => {
    const raw = localStorage.getItem("admin_user");
    if (!raw || raw === "undefined" || raw === "null") return {};
    try { return JSON.parse(raw); } catch { return {}; }
  };
  const adminUser = getAdminUser();
  const isSuperAdmin = adminUser.adminRole === "super_admin" || adminUser.role === "super_admin" || adminUser.permissions === "all" || adminUser.email === "fanuelgoitom79@gmail.com";
  // All administrators have full access to manage and suspend/restore providers
  const canModifyProviders = true;

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProviders();
      setProviders(Array.isArray(data) ? data : (data as any)?.data || []);
      setLastUpdated(new Date());
      setSelectedIds(new Set());
    } catch (err: any) {
      setProviders([]);
      setError(err.message || "Failed to load providers.");
      toast(err.response?.data?.message || err.message || "Failed to load providers", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  // Real-time updates without refreshing
  useRealtimeSocket({
    user_status_changed: (data: any) => {
      const targetId = data?.userId || data?.id;
      const newStatus = data?.status;
      if (targetId && newStatus) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === targetId || p.userId === targetId ? { ...p, status: newStatus } : p
          )
        );
      }
    },
    user_removed: (data: any) => {
      const removedId = data?.userId || data?.id;
      if (removedId) {
        setProviders((prev) =>
          prev.filter((p) => p.id !== removedId && p.userId !== removedId)
        );
      }
    },
    approval_requested: () => {
      loadProviders();
    },
  });

  const confirmToggleSuspend = async () => {
    if (!selectedProvider) return;
    const targetId = selectedProvider.id;
    const currentStatus = selectedProvider.status;
    const nextStatus = currentStatus === "suspended" ? "verified" : "suspended";

    // Optimistically toggle provider status immediately without waiting or refreshing
    setProviders((prev) =>
      prev.map((p) => (p.id === targetId ? { ...p, status: nextStatus } : p))
    );

    try {
      await api.toggleProviderSuspension(targetId, currentStatus);
      toast(`Provider ${currentStatus === "suspended" ? "restored" : "suspended"} successfully.`, "success");
    } catch (err: any) {
      toast(err.message || "Failed to update provider status.", "error");
      loadProviders();
    } finally {
      setSuspendModal(false);
      setSelectedProvider(null);
    }
  };

  const confirmDeleteProvider = async () => {
    if (!providerToDelete) return;
    const targetId = providerToDelete.id;
    try {
      await api.deleteProvider(targetId);
      toast(`Provider ${providerToDelete.name} removed immediately.`, "success");
      setProviders((prev) => prev.filter((p) => p.id !== targetId && p.userId !== targetId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to remove provider.", "error");
      loadProviders();
    } finally {
      setDeleteModal(false);
      setProviderToDelete(null);
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

  const handleOpenContact = (provider: any) => {
    setProviderToContact(provider);
    setContactTitle("");
    setContactMessage("");
    setContactPriority("normal");
    setContactModal(true);
  };

  const handleSendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerToContact || !contactTitle.trim() || !contactMessage.trim()) {
      toast("Please provide both a subject and message", "warning");
      return;
    }
    setSendingContact(true);
    try {
      await api.contactProvider(providerToContact.id, {
        title: contactTitle.trim(),
        message: contactMessage.trim(),
        priority: contactPriority,
      });
      toast(`Direct dispatch sent to ${providerToContact.name}`, "success");
      setContactModal(false);
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to send dispatch to provider", "error");
    } finally {
      setSendingContact(false);
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
  const providerList = Array.isArray(providers) ? providers : [];
  const filtered = providerList.filter(p => {
    const matchesSearch = (p.name || "").toLowerCase().includes(search.toLowerCase()) || 
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
                      {(row.phone || (row as any).user?.phone) && (
                        <a
                          href={`tel:${row.phone || (row as any).user?.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-[#0d7c6a] hover:underline font-mono font-semibold"
                          title={`Call ${row.name}`}
                        >
                          <Phone size={10} />
                          <span>{row.phone || (row as any).user?.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                )},
                { key: "status", header: "Verification", render: (row) => <StatusBadge status={row.status as any} /> },
                {
                  key: "contact",
                  header: "Phone / Contact",
                  render: (row) => {
                    const phone = row.phone || (row as any).user?.phone;
                    const email = row.email || (row as any).user?.email;
                    return (
                      <div className="space-y-1">
                        {phone ? (
                          <a
                            href={`tel:${phone.replace(/\s+/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#0d7c6a] dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                            title={`Call ${row.name}`}
                          >
                            <Phone size={10} />
                            <span>{phone}</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-[#8a9aaa] italic">No phone listed</span>
                        )}
                        {email && (
                          <span className="text-[10px] text-[#8a9aaa] block truncate max-w-[130px]" title={email}>
                            {email}
                          </span>
                        )}
                      </div>
                    );
                  },
                },
                { key: "rating", header: "Rating", render: (row) => <Rating value={row.rating as number || 5.0} count={row.reviewCount as number || 0} /> },
                { key: "experience", header: "Experience", render: (row) => <span className="text-sm">{row.experience as number || 0}y</span> },
                { key: "completedServices", header: "Services", render: (row) => <span className="font-semibold text-[#0d7c6a] dark:text-cyan-400">{row.completedServices as number || 0}</span> },
                { key: "actions", header: "Actions", render: (row) => (
                  <div className="flex gap-1 items-center">
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 cursor-pointer" onClick={() => { setSelectedDetails(row); setDetailsModal(true); }}>View</Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-xs !py-1 !px-2 text-[#0d7c6a] dark:text-cyan-400 hover:!bg-teal-50 dark:hover:!bg-teal-950/30 flex items-center gap-1 cursor-pointer"
                      onClick={() => handleOpenContact(row)}
                      title="Contact Healthcare Provider"
                    >
                      <MessageSquare size={13} />
                      <span>Contact</span>
                    </Button>
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
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      disabled={!canModifyProviders}
                      className="text-xs !py-1 !px-2 text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/30 disabled:opacity-50 cursor-pointer flex items-center gap-1" 
                      onClick={() => { setProviderToDelete(row); setDeleteModal(true); }}
                      title="Permanently remove provider immediately"
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
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

      <ConfirmDialog
        open={deleteModal}
        onClose={() => { setDeleteModal(false); setProviderToDelete(null); }}
        onConfirm={confirmDeleteProvider}
        title="Remove Healthcare Provider"
        message={`Are you sure you want to permanently remove provider "${providerToDelete?.name}"? Their provider account access and active sessions will be revoked immediately.`}
        confirmLabel="Remove Immediately"
        confirmVariant="danger"
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
            <div className="p-3 bg-[#f8fafc] dark:bg-slate-800/80 rounded-lg border border-[#eef2f6] dark:border-slate-700 space-y-1.5">
              <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider text-[10px]">Direct Contact Information</p>
              <div className="flex flex-wrap items-center gap-3">
                {(selectedDetails.phone || (selectedDetails as any).user?.phone) ? (
                  <a
                    href={`tel:${(selectedDetails.phone || (selectedDetails as any).user?.phone).replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#0d7c6a] dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                  >
                    <Phone size={12} />
                    <span>Call {selectedDetails.phone || (selectedDetails as any).user?.phone}</span>
                  </a>
                ) : (
                  <span className="text-xs text-[#8a9aaa] italic">No phone on record</span>
                )}
                {(selectedDetails.email || (selectedDetails as any).user?.email) && (
                  <a
                    href={`mailto:${selectedDetails.email || (selectedDetails as any).user?.email}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    <Mail size={12} />
                    <span>Email {selectedDetails.email || (selectedDetails as any).user?.email}</span>
                  </a>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <Button
                size="sm"
                className="flex items-center gap-1.5"
                onClick={() => {
                  setDetailsModal(false);
                  handleOpenContact(selectedDetails);
                }}
              >
                <MessageSquare size={13} />
                <span>Contact Clinician</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDetailsModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Contact Provider Modal */}
      <Modal open={contactModal} onClose={() => setContactModal(false)} title={`Contact Clinician: ${providerToContact?.name || ""}`}>
        {providerToContact && (
          <form onSubmit={handleSendContact} className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-[#f8fafc] dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
              <Avatar name={providerToContact.name} src={providerToContact.avatar} size="md" />
              <div className="flex-1">
                <p className="font-bold text-sm text-[#18232e] dark:text-white">{providerToContact.name}</p>
                <p className="text-[#8a9aaa]">{providerToContact.title || "Health Practitioner"} {providerToContact.specialty ? `• ${providerToContact.specialty}` : ""}</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {providerToContact.phone && (
                    <a
                      href={`tel:${providerToContact.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-50 dark:bg-teal-900/40 text-[#0d7c6a] dark:text-teal-300 font-semibold border border-teal-200 dark:border-teal-800 hover:bg-teal-100"
                    >
                      <Phone size={12} />
                      <span>Call {providerToContact.phone}</span>
                    </a>
                  )}
                  {providerToContact.email && (
                    <a
                      href={`mailto:${providerToContact.email}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                    >
                      <Mail size={12} />
                      <span>Email {providerToContact.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-semibold text-[#18232e] dark:text-white text-xs">Direct Administrative Dispatch</p>
              <Input
                label="Subject / Topic"
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
                placeholder="e.g. Credential Audit / Booking Follow-up"
                required
              />
              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">
                  Message Priority
                </label>
                <select
                  value={contactPriority}
                  onChange={(e) => setContactPriority(e.target.value as any)}
                  className="w-full text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                >
                  <option value="normal">Normal (Routine Inquiry)</option>
                  <option value="urgent">Urgent (Immediate Attention Required)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">
                  Message Content
                </label>
                <textarea
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Type your official administrative message for this provider..."
                  required
                  className="w-full border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-2.5 text-xs text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <Button type="button" variant="ghost" onClick={() => setContactModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={sendingContact} className="flex items-center gap-1.5">
                <Send size={13} />
                <span>Send Message</span>
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
