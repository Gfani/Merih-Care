import React, { useState, useEffect } from "react";
import { Card, DataTable, PriorityBadge, StatusBadge, Button, Modal, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { AlertTriangle } from "lucide-react";

export default function ComplaintsSection() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);

  // Permissions configuration
  const adminUser = JSON.parse(localStorage.getItem("admin_user") || "{}");
  const userRole = adminUser.role || "";
  const userPermissions = adminUser.permissions || [];
  const canResolve = userRole === "super_admin" || userPermissions.includes("edit:complaints") || userPermissions.includes("admin:complaints");

  const loadComplaints = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getComplaints();
      setComplaints(data);
      setLastUpdated(new Date());
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to load complaints.");
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
    loadComplaints();
  }, []);

  const handleResolve = async () => {
    if (!selectedComplaint) return;
    try {
      await api.resolveComplaint(selectedComplaint.id);
      toast("Complaint marked as resolved successfully.", "success");
      setSelectedComplaint(null);
      loadComplaints();
    } catch (err: any) {
      toast(err.message || "Failed to resolve complaint.", "error");
    }
  };

  const handleBulkResolve = async () => {
    if (!canResolve) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await api.resolveComplaint(id);
      }
      toast("Bulk complaints resolved successfully.", "success");
      loadComplaints();
    } catch (err: any) {
      toast(err.message || "Error processing bulk resolve.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filter/Sort Logic
  const filtered = complaints.filter(c => {
    const matchesStatus = statusFilter === "all" ? true : c.status === statusFilter;
    const matchesPriority = priorityFilter === "all" ? true : c.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open", count: complaints.filter(c => c.status === "open").length, color: "#d97706" },
          { label: "Under Review", count: complaints.filter(c => c.status === "under_review").length, color: "#1b6fba" },
          { label: "Resolved", count: complaints.filter(c => c.status === "resolved").length, color: "#16a34a" },
          { label: "Closed", count: complaints.filter(c => c.status === "closed").length, color: "#6b7280" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center shadow-xs">
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "DM Sans, sans-serif" }}>{s.count}</p>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Filter */}
        <select 
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        {/* Priority Filter */}
        <select 
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
          className="text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {isStale && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-xs rounded-[8px] flex justify-between items-center">
          <span className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" aria-hidden="true" />
            <span>Stale Data Warning: Complaint records were fetched more than 5 minutes ago.</span>
          </span>
          <Button size="sm" variant="ghost" onClick={loadComplaints} className="!py-0.5 !px-2 text-amber-900 font-bold hover:bg-amber-100">Refresh</Button>
        </div>
      )}

      {/* Sync Timestamp and Bulk Options */}
      <div className="text-[10px] text-[#8a9aaa] flex justify-between items-center px-1">
        <span>Last Sync: {lastUpdated.toLocaleTimeString()}</span>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#18232e] dark:text-slate-300">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" disabled={!canResolve} onClick={handleBulkResolve} className="!py-0.5 !px-2 text-[10px] text-green-600 border-green-200 hover:bg-green-50">
              Bulk Resolve
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
            <Button size="sm" onClick={loadComplaints} className="cursor-pointer">Retry Loading</Button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#8a9aaa]">
            No complaints found matching filters.
          </div>
        ) : (
          <div>
            <DataTable
              columns={[
                { 
                  key: "select", 
                  header: <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id as string)))} />,
                  render: (row) => <input type="checkbox" checked={selectedIds.has(row.id as string)} onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(row.id as string)) next.delete(row.id as string);
                    else next.add(row.id as string);
                    setSelectedIds(next);
                  }} />
                },
                { key: "id", header: "ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
                { key: "userName", header: "User", render: (row) => (
                  <div>
                    <p className="font-medium text-sm text-[#18232e] dark:text-white">{row.userName as string}</p>
                    <p className="text-xs text-[#8a9aaa] capitalize">{row.userRole as string}</p>
                  </div>
                )},
                { key: "subject", header: "Subject", render: (row) => <p className="text-sm max-w-[180px] truncate">{row.subject as string}</p> },
                { key: "priority", header: "Priority", render: (row) => <PriorityBadge priority={row.priority as any} /> },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
                { key: "createdAt", header: "Created", render: (row) => <span className="text-xs text-[#8a9aaa]">{row.createdAt as string}</span> },
                { key: "actions", header: "Actions", render: (row) => (
                  <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 cursor-pointer" onClick={() => setSelectedComplaint(row)}>Review</Button>
                )},
              ]}
              data={paginated as any}
            />

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-[#f0f4f7] dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 text-xs">
              <span className="text-[#8a9aaa]">Page {currentPage} of {totalPages} ({filtered.length} total complaints)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="cursor-pointer">Prev</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="cursor-pointer">Next</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {selectedComplaint && (
        <Modal open={!!selectedComplaint} onClose={() => setSelectedComplaint(null)} title="Complaint Details" footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setSelectedComplaint(null)}>Close</Button>
            {selectedComplaint.status !== "resolved" && (
              <Button 
                onClick={handleResolve} 
                disabled={!canResolve}
                className="disabled:opacity-50 cursor-pointer"
                title={!canResolve ? "Requires edit:complaints permission" : ""}
              >
                Mark Resolved
              </Button>
            )}
          </div>
        }>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <PriorityBadge priority={selectedComplaint.priority} />
              <StatusBadge status={selectedComplaint.status} />
            </div>
            <div className="text-xs border-t border-[#f0f4f7] dark:border-slate-700 pt-3 space-y-1">
              <p><span className="font-semibold text-[#8a9aaa]">User:</span> {selectedComplaint.userName} ({selectedComplaint.userRole})</p>
              <p><span className="font-semibold text-[#8a9aaa]">Created:</span> {selectedComplaint.createdAt}</p>
              {selectedComplaint.appointmentId && <p><span className="font-semibold text-[#8a9aaa]">Appointment ID:</span> <span className="font-mono">{selectedComplaint.appointmentId}</span></p>}
            </div>
            <div className="border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
              <h4 className="font-bold text-sm text-[#18232e] dark:text-white mb-1">{selectedComplaint.subject}</h4>
              <p className="text-xs text-[#4a5a6a] dark:text-slate-300 leading-relaxed bg-[#f4f7f9] dark:bg-slate-750 p-3 rounded-[8px]">
                {selectedComplaint.description || "No detailed description provided."}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
