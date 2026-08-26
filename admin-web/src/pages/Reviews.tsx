import React, { useState } from "react";
import { Card, DataTable, Rating, StatusBadge, Button, ConfirmDialog, Modal, toast } from "../components/ui";
import { reviews as mockReviews } from "../data/mock";

export default function ReviewsSection() {
  const [reviews, setReviews] = useState(mockReviews);

  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [approveAction, setApproveAction] = useState(true);

  const [detailsModal, setDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);

  const handleModerateClick = (row: any, approve: boolean) => {
    setSelectedReview(row);
    setApproveAction(approve);
    setConfirmModal(true);
  };

  const confirmModerate = () => {
    if (!selectedReview) return;
    const nextStatus = approveAction ? "published" as const : "hidden" as const;
    setReviews(prev => prev.map(r => r.id === selectedReview.id ? { ...r, status: nextStatus } : r));
    toast(approveAction ? "Review approved and published" : "Review hidden from public view", "info");
    setConfirmModal(false);
    setSelectedReview(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <DataTable
          columns={[
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
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#16a34a]" onClick={() => handleModerateClick(row, true)}>Approve</Button>
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626]" onClick={() => handleModerateClick(row, false)}>Hide</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2" onClick={() => { setSelectedDetails(row); setDetailsModal(true); }}>View</Button>
                )}
              </div>
            )},
          ]}
          data={reviews as any}
        />
      </Card>

      <ConfirmDialog
        open={confirmModal}
        onClose={() => setConfirmModal(false)}
        onConfirm={confirmModerate}
        title={approveAction ? "Approve Review" : "Hide Review"}
        message={`Are you sure you want to ${approveAction ? "approve" : "hide"} this review by ${selectedReview?.reviewerName}?`}
        confirmLabel={approveAction ? "Approve" : "Hide"}
        confirmVariant={approveAction ? "success" : "danger"}
      />

      <Modal open={detailsModal} onClose={() => setDetailsModal(false)} title="Review Details">
        {selectedDetails && (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[#18232e] dark:text-white">From: {selectedDetails.reviewerName}</h4>
                <p className="text-xs text-[#8a9aaa] dark:text-slate-400">To: {selectedDetails.providerName}</p>
              </div>
              <StatusBadge status={selectedDetails.status === "flagged" ? "disputed" : selectedDetails.status} />
            </div>
            <div className="border-t border-[#f0f4f7] dark:border-slate-700 pt-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#8a9aaa] dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Rating:</span>
                <Rating value={selectedDetails.rating} showCount={false} />
              </div>
              <div>
                <p className="text-xs text-[#8a9aaa] dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Service Provided</p>
                <p className="text-xs text-[#18232e] dark:text-slate-200">{selectedDetails.service}</p>
              </div>
              <div>
                <p className="text-xs text-[#8a9aaa] dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">Full Comment</p>
                <p className="text-xs text-[#4a5a6a] dark:text-slate-350 bg-[#f8fafc] dark:bg-slate-900 border border-[#e2e8ee] dark:border-slate-700 p-2.5 rounded-lg whitespace-pre-line italic">
                  "{selectedDetails.comment}"
                </p>
              </div>
              <div className="flex justify-between text-[11px] text-[#8a9aaa]">
                <span>Date Published</span>
                <span>{selectedDetails.date}</span>
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
