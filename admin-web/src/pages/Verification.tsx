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
  const [selectedDocProvider, setSelectedDocProvider] = useState<any>(null);

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
      const data = await api.getVerificationQueue();
      setProviders(Array.isArray(data) ? data : []);
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
      setPendingAdmins(Array.isArray(data) ? data : []);
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

  const pending = providers.filter(p => !p.verified || p.status === "pending_verification" || p.status === "pending" || p.status === "needs_fix");

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
                  <div className="flex items-start gap-3 mb-3 pb-3 border-b border-[#f0f4f7] dark:border-slate-700">
                    <Avatar src={provider.avatar} name={provider.name} size="lg" />
                    <div className="flex-1">
                      <p className="font-semibold text-[#18232e] dark:text-white">{provider.name}</p>
                      <p className="text-xs text-[#8a9aaa] dark:text-slate-400">
                        {provider.title || "Healthcare Provider"} {provider.specialty ? `• ${provider.specialty}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={provider.status === "needs_fix" ? "needs_fix" : "pending"} />
                        {provider.licenseNumber && (
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            License: {provider.licenseNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Professional Credentials Overview */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3.5 p-2.5 bg-[#f8fafc] dark:bg-slate-800/80 rounded-lg border border-[#eef2f6] dark:border-slate-700">
                    <div>
                      <span className="text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase font-bold block">Experience</span>
                      <span className="font-medium text-[#18232e] dark:text-white">
                        {provider.experience ? `${provider.experience} years` : "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase font-bold block">Affiliation</span>
                      <span className="font-medium text-[#18232e] dark:text-white truncate block">
                        {provider.hospitalAffiliation || "Private Practice"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase font-bold block">Education</span>
                      <span className="font-medium text-[#18232e] dark:text-white block">
                        {provider.education || "Medical Qualification"}
                      </span>
                    </div>
                    {(provider.email || provider.phone) && (
                      <div className="col-span-2 border-t border-[#e2e8f0] dark:border-slate-700 pt-1.5 mt-0.5">
                        <span className="text-[#8a9aaa] dark:text-slate-400 text-[10px] uppercase font-bold block">Contact</span>
                        <span className="font-medium text-[#18232e] dark:text-white">
                          {provider.email || ""} {provider.phone ? `• ${provider.phone}` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Submitted Documents */}
                  <div className="space-y-1.5 mb-4">
                    <p className="text-[11px] font-bold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide">Submitted Documents</p>
                    {[
                      { title: "Curriculum Vitae (CV)", url: provider.cvUrl, required: true },
                      { title: "Medical License", url: provider.licenseDocumentUrl || provider.licenseNumber, required: true },
                      { title: "Government ID / Passport", url: provider.idDocumentUrl, required: false },
                    ].map(doc => (
                      <div key={doc.title} className="flex items-center justify-between text-xs py-1.5 border-b border-[#f0f4f7] dark:border-slate-700 last:border-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#4a5a6a] dark:text-slate-300 font-medium">{doc.title}</span>
                          {doc.required && <span className="text-red-500 font-bold">*</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedDoc(doc.title);
                              setSelectedDocProvider(provider);
                              setDocModal(true);
                            }}
                            className="text-xs text-[#0d7c6a] dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                          >
                            View
                          </button>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${doc.url ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300" : "bg-slate-100 text-slate-500"}`}>
                            {doc.url ? "Attached" : "Optional"}
                          </span>
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
      <Modal open={docModal} onClose={() => setDocModal(false)} maxWidth="sm:max-w-4xl" title={`Credential Document: ${selectedDoc || ""}`}>
        {selectedDoc && selectedDocProvider && (() => {
          let raw = "";
          const isLicenseField = selectedDoc === "Medical License";
          if (selectedDoc === "Curriculum Vitae (CV)") {
            raw = selectedDocProvider.cvUrl || "";
          } else if (isLicenseField) {
            raw = selectedDocProvider.licenseDocumentUrl || "";
          } else {
            raw = selectedDocProvider.idDocumentUrl || "";
          }

          let resolvedUrl = "";
          if (raw && typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
              if (trimmed.includes("storage.merihcare.et")) {
                let key = trimmed;
                if (key.includes("/signed/")) {
                  key = key.split("/signed/")[1]?.split("?")[0] || "";
                  key = decodeURIComponent(key);
                } else if (key.includes("/credentials/")) {
                  key = "credentials/" + key.split("/credentials/")[1];
                } else {
                  key = key.split("/").pop() || "";
                }
                resolvedUrl = `http://localhost:3000/api/v1/uploads/view/${encodeURIComponent(key)}`;
              } else {
                resolvedUrl = trimmed;
              }
            } else if (trimmed.startsWith("/") || trimmed.startsWith("credentials/")) {
              resolvedUrl = `http://localhost:3000/api/v1/uploads/view/${encodeURIComponent(trimmed)}`;
            } else if (trimmed.includes(".")) {
              resolvedUrl = `http://localhost:3000/api/v1/uploads/view/${encodeURIComponent(trimmed)}`;
            }
          }

          const hasPhysicalFile = !!resolvedUrl;
          const downloadUrl = resolvedUrl ? resolvedUrl.replace("/uploads/view", "/uploads/download") : "";
          const lower = resolvedUrl.toLowerCase();
          const isImage = hasPhysicalFile && (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif"));
          const isPdf = hasPhysicalFile && !isImage;

          return (
            <div className="space-y-4">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#f8fafc] dark:bg-slate-900 rounded-xl border border-[#e2e8ee] dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <Avatar src={selectedDocProvider.avatar} name={selectedDocProvider.name} size="sm" />
                  <div>
                    <p className="text-xs font-semibold text-[#18232e] dark:text-white leading-tight">
                      {selectedDocProvider.name}
                    </p>
                    <p className="text-[11px] text-[#8a9aaa] dark:text-slate-400">
                      {selectedDocProvider.specialty || selectedDocProvider.title || "Healthcare Provider"}
                      {selectedDocProvider.licenseNumber ? ` • License: ${selectedDocProvider.licenseNumber}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                    {hasPhysicalFile ? (isPdf ? "PDF Document" : isImage ? "Scanned Image" : "Official Upload") : "License Record"}
                  </span>
                  {hasPhysicalFile && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs !py-1 !px-2.5"
                        onClick={() => window.open(resolvedUrl, "_blank")}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1 inline-block">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        New Window
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs !py-1 !px-2.5"
                        onClick={() => window.open(downloadUrl, "_blank")}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1 inline-block">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Document Display Canvas */}
              {hasPhysicalFile ? (
                isImage ? (
                  <div className="w-full h-[540px] bg-slate-950 rounded-xl flex items-center justify-center p-3 border border-slate-700 overflow-auto shadow-inner">
                    <img
                      src={resolvedUrl}
                      alt={selectedDoc}
                      className="max-h-full max-w-full object-contain rounded shadow"
                    />
                  </div>
                ) : (
                  <div className="w-full h-[540px] rounded-xl overflow-hidden border border-[#e2e8ee] dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-inner">
                    <iframe
                      src={`${resolvedUrl}#toolbar=1`}
                      className="w-full h-full border-0"
                      title={selectedDoc}
                    />
                  </div>
                )
              ) : isLicenseField && selectedDocProvider.licenseNumber ? (
                /* Structured Credential Sheet */
                <div className="p-6 bg-gradient-to-br from-[#f8fbfb] to-[#edf6f4] dark:from-slate-900 dark:to-slate-800 rounded-xl border border-teal-200 dark:border-teal-800 text-left space-y-4">
                  <div className="flex items-center justify-between border-b border-teal-200/60 dark:border-teal-800/60 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#0d7c6a] dark:text-cyan-400">
                        Official Verification Certificate
                      </span>
                      <h4 className="text-base font-bold text-[#18232e] dark:text-white">
                        Federal Ministry of Health & Merihcare Provider License
                      </h4>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-[#0d7c6a] dark:text-cyan-400">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
                      <span className="text-[10px] font-bold uppercase text-[#8a9aaa] dark:text-slate-400 block">
                        Professional License / Registry ID
                      </span>
                      <span className="text-sm font-mono font-bold text-[#0d7c6a] dark:text-cyan-400">
                        {selectedDocProvider.licenseNumber}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
                      <span className="text-[10px] font-bold uppercase text-[#8a9aaa] dark:text-slate-400 block">
                        Healthcare Practitioner
                      </span>
                      <span className="text-sm font-semibold text-[#18232e] dark:text-white">
                        {selectedDocProvider.name}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
                      <span className="text-[10px] font-bold uppercase text-[#8a9aaa] dark:text-slate-400 block">
                        Specialty / Department
                      </span>
                      <span className="font-medium text-[#18232e] dark:text-white">
                        {selectedDocProvider.specialty || selectedDocProvider.title || "Clinical Practice"}
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
                      <span className="text-[10px] font-bold uppercase text-[#8a9aaa] dark:text-slate-400 block">
                        Hospital / Clinic Affiliation
                      </span>
                      <span className="font-medium text-[#18232e] dark:text-white">
                        {selectedDocProvider.hospitalAffiliation || "Independent Practice"}
                      </span>
                    </div>

                    <div className="col-span-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
                      <span className="text-[10px] font-bold uppercase text-[#8a9aaa] dark:text-slate-400 block">
                        Certified Medical Qualification
                      </span>
                      <span className="font-medium text-[#18232e] dark:text-white">
                        {selectedDocProvider.education || "University Healthcare Degree"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-[#8a9aaa] dark:text-slate-400">
                    <span>Registry Status: Active Pending Approval</span>
                    <span className="font-mono">Security Check: Verified Digital Record</span>
                  </div>
                </div>
              ) : (
                /* No Document Uploaded State */
                <div className="p-8 text-center bg-[#f8fafc] dark:bg-slate-900 rounded-xl border border-dashed border-[#cbd5e1] dark:border-slate-700 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-semibold text-sm text-[#18232e] dark:text-white">No Document File Uploaded</h5>
                    <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mt-1 max-w-sm mx-auto">
                      The provider has not yet submitted a digital scan for {selectedDoc}. You can request a fix or require them to re-upload before approval.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDocModal(false);
                      setSelectedFixProvider(selectedDocProvider);
                      setFixComment(`Please upload a valid copy of your ${selectedDoc}.`);
                      setFixModal(true);
                    }}
                  >
                    Request {selectedDoc} Upload
                  </Button>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-[#f0f4f7] dark:border-slate-700 text-xs">
                <span className="text-[#8a9aaa] dark:text-slate-400 truncate max-w-md">
                  {raw ? `Document Source: ${raw}` : "No file source attached"}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDocModal(false)}>Close</Button>
                </div>
              </div>
            </div>
          );
        })()}
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
