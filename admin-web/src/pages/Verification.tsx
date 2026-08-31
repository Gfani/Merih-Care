import React, { useState, useEffect } from "react";
import { Alert, Card, Avatar, StatusBadge, Button, DataTable, ConfirmDialog, Modal, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";

export default function VerificationSection() {
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [approveModal, setApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [docModal, setDocModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const [fixModal, setFixModal] = useState(false);
  const [fixComment, setFixComment] = useState("");
  const [selectedFixProvider, setSelectedFixProvider] = useState<any>(null);

  const [reviewModal, setReviewModal] = useState(false);
  const [reviewProvider, setReviewProvider] = useState<any>(null);

  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Administrative Approvals State
  const [activeTab, setActiveTab] = useState<"providers" | "admins">("providers");
  const [pendingAdmins, setPendingAdmins] = useState<any[]>([]);
  const [adminApproveModal, setAdminApproveModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

  const userStr = localStorage.getItem("admin_user");
  const user = (() => {
    if (!userStr || userStr === "undefined" || userStr === "null") return null;
    try { return JSON.parse(userStr); } catch { return null; }
  })();
  const isSuperAdmin = user?.adminRole === "super_admin" || user?.email === "admin@merihcare.et";

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

  const loadAdmins = async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await api.getPendingAdmins();
      setPendingAdmins(data);
    } catch {
      toast("Failed to load administrative approvals", "error");
    }
  };

  useEffect(() => {
    loadData();
    if (isSuperAdmin) {
      loadAdmins();
    }
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
      await api.rejectProvider(selectedProvider.id, rejectReason || "Documents did not pass checks");
      toast(`Verification rejected for ${selectedProvider?.name}`, "warning");
      loadData();
    } catch {
      toast("Failed to reject provider", "error");
    } finally {
      setRejectModal(false);
    }
  };

  const handleRequestCorrections = async () => {
    if (!selectedFixProvider || !fixComment) return;
    try {
      await api.requestCorrections(selectedFixProvider.id, fixComment);
      toast(`Correction request sent to ${selectedFixProvider?.name}`, "info");
      loadData();
    } catch {
      toast("Failed to request corrections", "error");
    } finally {
      setFixModal(false);
    }
  };

  const handleApproveAdmin = async () => {
    if (!selectedAdmin) return;
    try {
      await api.approveAdminAccount(selectedAdmin.id);
      toast(`${selectedAdmin?.name} has been approved as an administrator!`, "success");
      loadAdmins();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || "Failed to approve administrator";
      toast(errMsg, "error");
    } finally {
      setAdminApproveModal(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {isSuperAdmin && (
        <div className="flex border-b border-[#e2e8ee] dark:border-slate-700 mb-2">
          <button
            onClick={() => setActiveTab("providers")}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "providers"
                ? "border-[#0d7c6a] text-[#0d7c6a] dark:text-cyan-400 dark:border-cyan-400"
                : "border-transparent text-[#8a9aaa] hover:text-[#4a5a6a] dark:text-slate-400"
            }`}
          >
            Provider Verifications ({pending.length})
          </button>
          <button
            onClick={() => setActiveTab("admins")}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "admins"
                ? "border-[#0d7c6a] text-[#0d7c6a] dark:text-cyan-400 dark:border-cyan-400"
                : "border-transparent text-[#8a9aaa] hover:text-[#4a5a6a] dark:text-slate-400"
            }`}
          >
            Administrative Approvals ({pendingAdmins.length})
          </button>
        </div>
      )}

      {activeTab === "providers" ? (
        <>
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
                  <div className="flex items-start gap-3 mb-4 pb-4 border-b border-[#f0f4f7] dark:border-slate-700">
                    <Avatar src={provider.avatar} name={provider.name} size="lg" />
                    <div className="flex-1">
                      <p className="font-semibold text-[#18232e] dark:text-white">{provider.name}</p>
                      <p className="text-sm text-[#8a9aaa] dark:text-slate-400">{provider.title}</p>
                      <div className="mt-1">
                        <StatusBadge status={provider.status === "needs_fix" ? "needs_fix" : "pending"} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide">Submitted Documents</p>
                    {["Professional License", "National ID", "Academic Certificate", "Police Clearance"].map(doc => (
                      <div key={doc} className="flex items-center justify-between text-sm py-1.5 border-b border-[#f0f4f7] dark:border-slate-700 last:border-0">
                        <span className="text-[#4a5a6a] dark:text-slate-300">{doc}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedDoc(doc); setDocModal(true); }}
                            className="text-xs text-[#1b6fba] dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                          >
                            View
                          </button>
                          <StatusBadge status="pending" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="danger" size="sm" className="flex-1" onClick={() => { setSelectedProvider(provider); setRejectReason(""); setRejectModal(true); }}>Reject</Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedFixProvider(provider); setFixComment(""); setFixModal(true); }}>Request Fix</Button>
                    <Button size="sm" className="flex-1" onClick={() => { setSelectedProvider(provider); setApproveModal(true); }}>
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="inline-block mr-1"><path d="M1 5l3 3.5L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Approve
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          <Card>
            <div className="p-4 border-b border-[#e2e8ee] dark:border-slate-700">
              <p className="text-sm font-semibold text-[#18232e] dark:text-white">All Provider Verifications</p>
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
                  { key: "joinedDate", header: "Submitted", render: (row) => <span className="text-xs text-[#8a9aaa] dark:text-slate-400">{row.joinedDate as string}</span> },
                  { key: "actions", header: "Actions", render: (row) => (
                    <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2" onClick={() => { setReviewProvider(row); setReviewModal(true); }}>Review</Button>
                  )},
                ]}
                data={providers as any}
              />
            )}
          </Card>
        </>
      ) : (
        <>
          {pendingAdmins.length > 0 ? (
            <Alert variant="warning" title={`${pendingAdmins.length} administrative signups pending`}>
              Validate administrative identities and roles before enabling access keys.
            </Alert>
          ) : (
            <Alert variant="success" title="No admin approvals pending">
              All administrative access requests have been approved.
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingAdmins.map(admin => (
              <Card key={admin.id} className="p-5 animate-fade-in">
                <div className="flex items-start gap-3 mb-4 pb-4 border-b border-[#f0f4f7] dark:border-slate-700">
                  <Avatar name={admin.name} size="lg" />
                  <div className="flex-1">
                    <p className="font-semibold text-[#18232e] dark:text-white text-sm">{admin.name}</p>
                    <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mt-0.5">{admin.email}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0f4f7] dark:bg-slate-750 text-[#1b6fba] dark:text-cyan-400 uppercase tracking-wide">
                        {admin.adminRole ? admin.adminRole.replace("_", " ") : "admin"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="w-full" onClick={() => { setSelectedAdmin(admin); setAdminApproveModal(true); }}>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="inline-block mr-1"><path d="M1 5l3 3.5L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Approve Request
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog open={approveModal} onClose={() => setApproveModal(false)} onConfirm={handleApprove} title="Approve Provider" message={`You are approving ${selectedProvider?.name} as a verified Merihcare provider. They will be able to accept service requests immediately.`} confirmLabel="Approve" confirmVariant="success" />
      <ConfirmDialog open={adminApproveModal} onClose={() => setAdminApproveModal(false)} onConfirm={handleApproveAdmin} title="Approve Administrator Account" message={`You are approving the administrative signup request for ${selectedAdmin?.name} (${selectedAdmin?.email}) with the role of ${selectedAdmin?.adminRole?.replace("_", " ")}. They will immediately gain access to corresponding dashboard features.`} confirmLabel="Approve" confirmVariant="success" />

      {/* Reject Verification Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Verification" footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejectModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleReject}>Reject Verification</Button>
        </div>
      }>
        <div className="space-y-3">
          <p className="text-sm text-[#4a5a6a] dark:text-slate-350">
            You are rejecting the verification for <span className="font-semibold">{selectedProvider?.name}</span>. Please specify the reason for rejection:
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. The submitted national ID card appears expired and the professional registration number cannot be validated."
            className="w-full border border-[#e2e8ee] dark:border-slate-700 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-800 text-[#18232e] dark:text-slate-100 focus:outline-none focus:border-[#0d7c6a] resize-none"
          />
        </div>
      </Modal>

      {/* Document View Modal */}
      <Modal open={docModal} onClose={() => setDocModal(false)} title="Document View">
        {selectedDoc && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mb-2">Simulated File: {selectedDoc}</p>
            <div className="w-full h-48 bg-[#f4f7f9] dark:bg-slate-900 rounded-[10px] flex flex-col items-center justify-center border border-[#e2e8ee] dark:border-slate-700">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#0d7c6a] dark:text-cyan-400 mb-2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p className="text-xs font-semibold text-[#18232e] dark:text-white">Official Verification Certificate</p>
              <p className="text-[10px] text-[#8a9aaa] dark:text-slate-400 mt-0.5">Digitally Approved by Merihcare Security</p>
            </div>
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setDocModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Request Corrections Modal */}
      <Modal open={fixModal} onClose={() => setFixModal(false)} title="Request Document Corrections" footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFixModal(false)}>Cancel</Button>
          <Button onClick={handleRequestCorrections}>Send Request</Button>
        </div>
      }>
        <div className="space-y-3">
          <p className="text-xs text-[#4a5a6a] dark:text-slate-350">Provide concrete instructions for the fields or documents that need to be re-uploaded or corrected.</p>
          <textarea
            rows={4}
            value={fixComment}
            onChange={(e) => setFixComment(e.target.value)}
            placeholder="e.g. Please re-upload your professional license. The uploaded image is blurry and the license number is illegible."
            className="w-full border border-[#e2e8ee] dark:border-slate-700 rounded-lg p-2.5 text-sm bg-white dark:bg-slate-800 text-[#18232e] dark:text-slate-100 focus:outline-none focus:border-[#0d7c6a] resize-none"
          />
        </div>
      </Modal>

      {/* Review Details Modal */}
      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Verification Review">
        {reviewProvider && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={reviewProvider.avatar} name={reviewProvider.name} size="lg" />
              <div>
                <h4 className="font-bold text-sm text-[#18232e] dark:text-white">{reviewProvider.name}</h4>
                <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{reviewProvider.title}</p>
              </div>
            </div>
            <div className="space-y-2 border-t border-[#f0f4f7] dark:border-slate-700 pt-3">
              <p className="text-xs font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide">Verification Details</p>
              <div className="flex justify-between text-xs py-1 text-[#4a5a6a] dark:text-slate-300">
                <span>Application Date</span>
                <span className="text-[#18232e] dark:text-white">{reviewProvider.joinedDate || "N/A"}</span>
              </div>
              <div className="flex justify-between text-xs py-1 text-[#4a5a6a] dark:text-slate-300">
                <span>Verification State</span>
                <StatusBadge status={reviewProvider.status} />
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
              <Button size="sm" onClick={() => setReviewModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
