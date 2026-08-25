import React, { useState } from "react";
import { Card, DataTable, PriorityBadge, StatusBadge, Button, Modal, toast } from "../components/ui";
import { complaints as mockComplaints } from "../data/mock";

export default function ComplaintsSection() {
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [complaints, setComplaints] = useState(mockComplaints);

  const handleResolve = () => {
    if (!selectedComplaint) return;
    setComplaints(prev => prev.map(c => c.id === selectedComplaint.id ? { ...c, status: "resolved" as any } : c));
    toast("Complaint marked as resolved", "success");
    setSelectedComplaint(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open", count: complaints.filter(c => c.status === "open").length, color: "#d97706" },
          { label: "Under Review", count: complaints.filter(c => c.status === "under_review").length, color: "#1b6fba" },
          { label: "Resolved", count: complaints.filter(c => c.status === "resolved").length, color: "#16a34a" },
          { label: "Closed", count: complaints.filter(c => c.status === "closed").length, color: "#6b7280" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "DM Sans, sans-serif" }}>{s.count}</p>
            <p className="text-xs text-[#8a9aaa]">{s.label}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "id", header: "ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
            { key: "userName", header: "User", render: (row) => (
              <div><p className="font-medium text-sm">{row.userName as string}</p><p className="text-xs text-[#8a9aaa] capitalize">{row.userRole as string}</p></div>
            )},
            { key: "subject", header: "Subject", render: (row) => <p className="text-sm max-w-[180px] truncate">{row.subject as string}</p> },
            { key: "priority", header: "Priority", render: (row) => <PriorityBadge priority={row.priority as any} /> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "createdAt", header: "Created", render: (row) => <span className="text-xs text-[#8a9aaa]">{row.createdAt as string}</span> },
            { key: "actions", header: "Actions", render: (row) => (
              <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2" onClick={() => setSelectedComplaint(row)}>Review</Button>
            )},
          ]}
          data={complaints as any}
          onRowClick={setSelectedComplaint}
        />
      </Card>
      {selectedComplaint && (
        <Modal open={!!selectedComplaint} onClose={() => setSelectedComplaint(null)} title="Complaint Details" footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setSelectedComplaint(null)}>Close</Button>
            {selectedComplaint.status !== "resolved" && (
              <Button onClick={handleResolve}>Mark Resolved</Button>
            )}
          </div>
        }>
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <StatusBadge status={selectedComplaint.status} />
              <PriorityBadge priority={selectedComplaint.priority} />
            </div>
            <p className="text-sm font-semibold text-[#18232e]">{selectedComplaint.subject}</p>
            <div className="text-sm text-[#4a5a6a] space-y-1">
              <p><span className="text-[#8a9aaa]">User:</span> {selectedComplaint.userName} ({selectedComplaint.userRole})</p>
              <p><span className="text-[#8a9aaa]">Category:</span> {selectedComplaint.category}</p>
              <p><span className="text-[#8a9aaa]">Created:</span> {selectedComplaint.createdAt}</p>
              {selectedComplaint.assignedAdmin && <p><span className="text-[#8a9aaa]">Assigned to:</span> {selectedComplaint.assignedAdmin}</p>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
