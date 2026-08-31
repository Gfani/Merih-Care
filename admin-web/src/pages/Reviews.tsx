import React, { useState, useEffect } from "react";
import { Card, DataTable, Rating, StatusBadge, Button, ConfirmDialog, Modal, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { AlertTriangle } from "lucide-react";

export default function ReviewsSection() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirm dialog state
  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [approveAction, setApproveAction] = useState(true);

  // View details modal state
  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  // Permissions configuration
  const getAdminUser = () => {
    const raw = localStorage.getItem("admin_user");
    if (!raw || raw === "undefined" || raw === "null") return {};
    try { return JSON.parse(raw); } catch { return {}; }
  };
  const adminUser = getAdminUser();
  const userRole = adminUser.role || "";
  const userPermissions = adminUser.permissions || [];
  const canModerate = userRole === "super_admin" || userPermissions.includes("edit:reviews") || userPermissions.includes("admin:reviews");

  const loadReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getReviews();
      setReviews(Array.isArray(data) ? data : (data as any)?.data || []);
      setLastUpdated(new Date());
      setSelectedIds(new Set());
    } catch (err: any) {
      setReviews([]);
      setError(err.message || "Failed to load reviews.");
      toast(err.response?.data?.message || err.message || "Failed to load reviews", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleModerateClick = (row: any, approve: boolean) => {
    setSelectedReview(row);
    setApproveAction(approve);
    setConfirmModal(true);
  };

  const confirmModerate = async () => {
    if (!selectedReview) return;
    try {
      const nextStatus = approveAction ? "published" : "hidden";
      await api.moderateReview(selectedReview.id, nextStatus);
      toast(approveAction ? "Review approved and published" : "Review hidden from public view", "success");
      loadReviews();
    } catch (err: any) {
      toast(err.message || "Failed to moderate review.", "error");
    } finally {
      setConfirmModal(false);
      setSelectedReview(null);
    }
  };

  const handleBulkModerate = async (approve: boolean) => {
    if (!canModerate) return;
    try {
      setLoading(true);
      const nextStatus = approve ? "published" : "hidden";
      for (const id of selectedIds) {
        await api.moderateReview(id, nextStatus);
      }
      toast(`Bulk reviews moderation processed.`, "success");
      loadReviews();
    } catch (err: any) {
      toast(err.message || "Error during bulk moderation.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  const reviewList = Array.isArray(reviews) ? reviews : [];
  const filtered = reviewList.filter(r => {
    const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
    const matchesRating = ratingFilter === "all" ? true : Math.floor(r.rating || 5) === parseInt(ratingFilter);
    return matchesStatus && matchesRating;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Moderation Statuses</option>
            <option value="published">Published</option>
            <option value="flagged">Flagged</option>
            <option value="hidden">Hidden</option>
          </select>

          {/* Rating Filter */}
          <select 
            value={ratingFilter}
            onChange={(e) => { setRatingFilter(e.target.value); setCurrentPage(1); }}
            className="text-xs border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {isStale && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-xs rounded-[8px] flex justify-between items-center">
          <span className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" aria-hidden="true" />
            <span>Stale Data Warning: Reviews records were fetched more than 5 minutes ago.</span>
          </span>
          <Button size="sm" variant="ghost" onClick={loadReviews} className="!py-0.5 !px-2 text-amber-900 font-bold hover:bg-amber-100">Refresh</Button>
        </div>
      )}

      {/* Sync Timestamp and Bulk Options */}
      <div className="text-[10px] text-[#8a9aaa] flex justify-between items-center px-1">
        <span>Last Sync: {lastUpdated.toLocaleTimeString()}</span>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#18232e] dark:text-slate-300">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" disabled={!canModerate} onClick={() => handleBulkModerate(true)} className="!py-0.5 !px-2 text-[10px] text-green-600 border-green-200 hover:bg-green-50">
              Bulk Approve
            </Button>
            <Button size="sm" variant="outline" disabled={!canModerate} onClick={() => handleBulkModerate(false)} className="!py-0.5 !px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50">
              Bulk Hide
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
            <Button size="sm" onClick={loadReviews} className="cursor-pointer">Retry Loading</Button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#8a9aaa]">
            No reviews found matching filters.
          </div>
        ) : (
          <div>
            <DataTable
              columns={[
                { 
                  key: "select", 
                  header: <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id as string)))} />,
                  render: (row) => <input type="checkbox" checked={selectedIds.has(row.id as string)} onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(row.id as string)) next.delete(row.id as string);
                    else next.add(row.id as string);
                    setSelectedIds(next);
                  }} />
                },
                { key: "reviewerName", header: "Reviewer" },
                { key: "providerName", header: "Provider" },
                { key: "rating", header: "Rating", render: (row) => <Rating value={row.rating as number} showCount={false} /> },
                { key: "comment", header: "Review", render: (row) => <p className="text-sm max-w-[200px] truncate text-[#4a5a6a] dark:text-slate-350">{row.comment as string}</p> },
                { key: "service", header: "Service" },
                { key: "date", header: "Date", render: (row) => <span className="text-xs text-[#8a9aaa] dark:text-slate-400">{row.date as string}</span> },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status === "flagged" ? "disputed" : (row.status as any)} /> },
                { key: "actions", header: "Actions", render: (row) => (
                  <div className="flex gap-1">
                    {row.status === "flagged" ? (
                      <>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          disabled={!canModerate}
                          className="text-xs !py-1 !px-2 text-[#16a34a] cursor-pointer" 
                          onClick={() => handleModerateClick(row, true)}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          disabled={!canModerate}
                          className="text-xs !py-1 !px-2 text-[#dc2626] cursor-pointer" 
                          onClick={() => handleModerateClick(row, false)}
                        >
                          Hide
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 cursor-pointer" onClick={() => { setSelectedDetails(row); setDetailsModal(true); }}>View</Button>
                    )}
                  </div>
                )},
              ]}
              data={paginated as any}
            />

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-[#f0f4f7] dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 text-xs">
              <span className="text-[#8a9aaa]">Page {currentPage} of {totalPages} ({filtered.length} total reviews)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="cursor-pointer">Prev</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="cursor-pointer">Next</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmModal}
        onClose={() => setConfirmModal(false)}
        onConfirm={confirmModerate}
        title={approveAction ? "Approve Review" : "Hide Review"}
        message={`Are you sure you want to ${approveAction ? "approve and publish" : "hide"} this review from public display?`}
        confirmLabel={approveAction ? "Approve" : "Hide"}
        confirmVariant={approveAction ? "success" : "danger"}
      />

      <Modal open={detailsModal} onClose={() => setDetailsModal(false)} title="Review Details">
        {selectedDetails && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase">Reviewer</p>
                <p className="text-sm font-bold text-[#18232e] dark:text-white">{selectedDetails.reviewerName}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase">Date</p>
                <p className="text-sm text-[#18232e] dark:text-slate-200">{selectedDetails.date}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase">Provider</p>
                <p className="text-sm font-bold text-[#18232e] dark:text-white">{selectedDetails.providerName}</p>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase">Service</p>
                <p className="text-[#18232e] dark:text-slate-200">{selectedDetails.service}</p>
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase">Rating</p>
                <Rating value={selectedDetails.rating} showCount={false} />
              </div>
              <div>
                <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase">Status</p>
                <StatusBadge status={selectedDetails.status === "flagged" ? "disputed" : selectedDetails.status} />
              </div>
            </div>
            <div className="border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
              <p className="font-semibold text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase mb-1">Feedback Comment</p>
              <p className="text-sm text-[#4a5a6a] dark:text-slate-300 italic bg-[#f4f7f9] dark:bg-slate-700 p-2.5 rounded-[8px]">
                "{selectedDetails.comment}"
              </p>
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
