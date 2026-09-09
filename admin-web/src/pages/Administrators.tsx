import React, { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, UserPlus, Trash2, KeyRound, Check, X,
  Search, RefreshCw, UserCheck, Phone, Building2, Calendar, AlertCircle
} from "lucide-react";
import { api } from "../services/api";
import { Avatar, toast } from "../components/ui";

export default function AdministratorsSection() {
  const [activeAdmins, setActiveAdmins] = useState<any[]>([]);
  const [pendingAdmins, setPendingAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");

  // Modals
  const [addAdminModal, setAddAdminModal] = useState(false);
  const [deleteAdminModal, setDeleteAdminModal] = useState(false);
  const [resetPassModal, setResetPassModal] = useState(false);
  const [adminToModify, setAdminToModify] = useState<any>(null);

  // Form states
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState("admin");
  const [addDept, setAddDept] = useState("Operations");
  const [addPhone, setAddPhone] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState("");
  const [resettingPass, setResettingPass] = useState(false);

  // Pending action state
  const [processingId, setProcessingId] = useState<string | null>(null);

  const userStr = localStorage.getItem("admin_user");
  const currentUser = (() => {
    if (!userStr || userStr === "undefined" || userStr === "null") return null;
    try { return JSON.parse(userStr); } catch { return null; }
  })();
  const currentEmailLower = (currentUser?.email || "").toLowerCase().trim();
  const isSuperAdmin =
    currentUser?.adminRole === "super_admin" ||
    currentUser?.role === "super_admin" ||
    currentEmailLower === "fanuelgoitom79@gmail.com" ||
    currentEmailLower === "fani@g.com";

  const loadData = async () => {
    setLoading(true);
    try {
      const [adminsRes, pendingRes] = await Promise.all([
        api.getAdministrators().catch(() => []),
        api.getPendingAdmins().catch(() => []),
      ]);
      setActiveAdmins(Array.isArray(adminsRes) ? adminsRes : []);
      setPendingAdmins(Array.isArray(pendingRes) ? pendingRes : []);
    } catch (err: any) {
      toast(err.message || "Failed to load administrators", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addEmail || !addPassword) {
      toast("Please provide name, email, and a secure password", "warning");
      return;
    }
    setSavingAdmin(true);
    try {
      await api.createAdministrator({
        name: addName,
        email: addEmail,
        password: addPassword,
        adminRole: addRole,
        department: addDept,
        phone: addPhone,
      });
      toast(`Administrator ${addName} provisioned successfully!`, "success");
      setAddAdminModal(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddDept("Operations");
      setAddPhone("");
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to create administrator", "error");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!adminToModify) return;
    setSavingAdmin(true);
    try {
      await api.deleteAdministrator(adminToModify.id);
      toast(`Administrator ${adminToModify.name} deleted successfully`, "success");
      setDeleteAdminModal(false);
      setAdminToModify(null);
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to delete administrator", "error");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToModify || !newPassword) return;
    setResettingPass(true);
    try {
      await api.resetAdministratorPassword(adminToModify.id, newPassword);
      toast(`Password for ${adminToModify.name} reset successfully`, "success");
      setResetPassModal(false);
      setAdminToModify(null);
      setNewPassword("");
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to reset password", "error");
    } finally {
      setResettingPass(false);
    }
  };

  const handleApprovePending = async (admin: any) => {
    setProcessingId(admin.id);
    try {
      await api.approveAdminAccount(admin.id);
      toast(`Admin account for ${admin.name} approved!`, "success");
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Approval failed", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPending = async (admin: any) => {
    setProcessingId(admin.id);
    try {
      await api.rejectAdminAccount(admin.id);
      toast(`Admin registration for ${admin.name} rejected`, "success");
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Rejection failed", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredAdmins = activeAdmins.filter((a) => {
    const term = searchQuery.toLowerCase();
    return (
      (a.name || "").toLowerCase().includes(term) ||
      (a.email || "").toLowerCase().includes(term) ||
      (a.adminRole || a.role || "").toLowerCase().includes(term) ||
      (a.department || "").toLowerCase().includes(term)
    );
  });

  const superAdminCount = activeAdmins.filter(
    (a) =>
      a.adminRole === "super_admin" ||
      a.role === "super_admin" ||
      (a.email || "").toLowerCase() === "fanuelgoitom79@gmail.com" ||
      (a.email || "").toLowerCase() === "fani@g.com"
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0d7c6a] to-[#085044] rounded-[16px] p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm">
              Super Admin Control
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Administrator Management</h1>
          <p className="text-sm text-emerald-100 mt-1 max-w-xl">
            Control platform administrators, assign operational roles, reset access credentials, and approve new administrative accounts.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => setAddAdminModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#0d7c6a] hover:bg-emerald-50 rounded-xl font-bold text-xs shadow-md transition-all shrink-0 active:scale-95"
          >
            <UserPlus size={16} />
            + Add Administrator
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wider">Total Administrators</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#18232e] dark:text-white">{activeAdmins.length}</span>
            <div className="p-2 rounded-lg bg-[#0d7c6a]/10 text-[#0d7c6a]">
              <ShieldCheck size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wider">Super Admins</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{superAdminCount}</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldAlert size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wider">Standard Admins</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-extrabold text-[#0d7c6a]">{Math.max(0, activeAdmins.length - superAdminCount)}</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600">
              <UserCheck size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wider">Pending Approvals</p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-2xl font-extrabold ${pendingAdmins.length > 0 ? "text-amber-500" : "text-[#18232e] dark:text-white"}`}>
              {pendingAdmins.length}
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <AlertCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#e2e8ee] dark:border-slate-700 p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "active"
                  ? "bg-[#0d7c6a] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              Active Administrators ({activeAdmins.length})
            </button>

            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all relative ${
                activeTab === "pending"
                  ? "bg-[#0d7c6a] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              Pending Approvals ({pendingAdmins.length})
              {pendingAdmins.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500 text-white">
                  {pendingAdmins.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-[#8a9aaa]" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search administrators..."
                className="w-full text-xs pl-8 pr-3 py-2 border border-[#e2e8ee] dark:border-slate-700 rounded-lg bg-[#f8fafc] dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
              />
            </div>
            <button
              onClick={loadData}
              title="Refresh"
              className="p-2 border border-[#e2e8ee] dark:border-slate-700 rounded-lg text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Content Table */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <RefreshCw size={24} className="animate-spin text-[#0d7c6a] mb-2" />
            <p className="text-xs text-[#8a9aaa]">Loading administrator records...</p>
          </div>
        ) : activeTab === "active" ? (
          filteredAdmins.length === 0 ? (
            <div className="py-12 text-center">
              <ShieldCheck size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-[#18232e] dark:text-white">No administrators found</p>
              <p className="text-xs text-[#8a9aaa] mt-1">Try refining your search filter or add a new administrator.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] dark:bg-slate-900/50 text-[#4a5a6a] dark:text-slate-400 font-bold border-b border-[#e2e8ee] dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Role & Access</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Created</th>
                    {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8ee] dark:divide-slate-700">
                  {filteredAdmins.map((admin) => {
                    const isRowSuperAdmin =
                      admin.adminRole === "super_admin" ||
                      admin.role === "super_admin" ||
                      (admin.email || "").toLowerCase() === "fanuelgoitom79@gmail.com" ||
                      (admin.email || "").toLowerCase() === "fani@g.com";
                    const isSelf = (admin.email || "").toLowerCase() === currentEmailLower;

                    return (
                      <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={admin.name || "Admin"} size="sm" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-[#18232e] dark:text-white">{admin.name}</span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#0d7c6a]/10 text-[#0d7c6a]">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#8a9aaa]">{admin.email}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isRowSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                              <ShieldAlert size={11} />
                              Super Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <ShieldCheck size={11} />
                              {(admin.adminRole || admin.role || "admin").replace(/_/g, " ").toUpperCase()}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[#4a5a6a] dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-[#8a9aaa]" />
                            <span>{admin.department || "Operations"}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-[#4a5a6a] dark:text-slate-300">
                          {admin.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone size={13} className="text-[#8a9aaa]" />
                              <span>{admin.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[#8a9aaa] italic">Not set</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[#8a9aaa]">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} />
                            <span>{admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "Active"}</span>
                          </div>
                        </td>

                        {isSuperAdmin && (
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setAdminToModify(admin);
                                  setNewPassword("");
                                  setResetPassModal(true);
                                }}
                                title="Reset Password"
                                className="px-2.5 py-1 rounded-lg border border-[#e2e8ee] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#0d7c6a] font-semibold text-[11px] flex items-center gap-1"
                              >
                                <KeyRound size={12} />
                                Reset
                              </button>

                              {!isSelf && (
                                <button
                                  onClick={() => {
                                    setAdminToModify(admin);
                                    setDeleteAdminModal(true);
                                  }}
                                  title="Delete Administrator"
                                  className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 font-semibold text-[11px] flex items-center gap-1"
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Pending Approvals View */
          pendingAdmins.length === 0 ? (
            <div className="py-12 text-center">
              <Check size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-semibold text-[#18232e] dark:text-white">All caught up!</p>
              <p className="text-xs text-[#8a9aaa] mt-1">No pending administrative registration requests waiting for review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] dark:bg-slate-900/50 text-[#4a5a6a] dark:text-slate-400 font-bold border-b border-[#e2e8ee] dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Requested Role</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Registered On</th>
                    <th className="py-3 px-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8ee] dark:divide-slate-700">
                  {pendingAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={admin.name || "Admin"} size="sm" />
                          <div>
                            <span className="font-bold text-[#18232e] dark:text-white block">{admin.name}</span>
                            <span className="text-[11px] text-[#8a9aaa]">{admin.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {admin.role || "admin"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#4a5a6a] dark:text-slate-300">
                        {admin.department || "Operations"}
                      </td>

                      <td className="py-3 px-4 text-[#8a9aaa]">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "Recent"}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={processingId === admin.id}
                            onClick={() => handleApprovePending(admin)}
                            className="px-3 py-1 bg-[#0d7c6a] hover:bg-[#0a6355] text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-sm transition-all"
                          >
                            <Check size={12} />
                            Approve
                          </button>
                          <button
                            disabled={processingId === admin.id}
                            onClick={() => handleRejectPending(admin)}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all"
                          >
                            <X size={12} />
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Add Administrator Modal */}
      {addAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2e8ee] dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8ee] dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0d7c6a]/10 text-[#0d7c6a]">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#18232e] dark:text-white">Provision New Administrator</h2>
                  <p className="text-[11px] text-[#8a9aaa]">Create and activate a verified platform admin</p>
                </div>
              </div>
              <button onClick={() => setAddAdminModal(false)} className="text-[#8a9aaa] hover:text-[#18232e]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Dr. Helen Petros"
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="helen.petros@merihcare.et"
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Temporary Initial Password</label>
                <input
                  type="password"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="At least 8 characters..."
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Administrative Role</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  >
                    <option value="admin">Operations Admin</option>
                    <option value="medical_admin">Medical Director</option>
                    <option value="support_admin">Support Specialist</option>
                    <option value="super_admin">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={addDept}
                    onChange={(e) => setAddDept(e.target.value)}
                    placeholder="Operations / Medical"
                    className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+251 91 234 5678"
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8ee] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setAddAdminModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="px-4 py-2 text-xs font-bold bg-[#0d7c6a] hover:bg-[#0a6355] text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  {savingAdmin ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  Provision Administrator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Administrator Confirmation Modal */}
      {deleteAdminModal && adminToModify && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-red-200 dark:border-red-900/40 space-y-4">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 w-12 h-12 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#18232e] dark:text-white">Delete Administrator?</h3>
              <p className="text-xs text-[#4a5a6a] dark:text-slate-300">
                Are you sure you want to delete administrator <span className="font-bold text-[#18232e] dark:text-white">{adminToModify.name}</span> ({adminToModify.email})?
              </p>
              <p className="text-[11px] text-red-500 font-semibold pt-1">
                This account will lose all access immediately.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteAdminModal(false);
                  setAdminToModify(null);
                }}
                className="flex-1 py-2 text-xs font-semibold text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAdmin}
                onClick={handleDeleteAdmin}
                className="flex-1 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-all"
              >
                {savingAdmin ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPassModal && adminToModify && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2e8ee] dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8ee] dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0d7c6a]/10 text-[#0d7c6a]">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#18232e] dark:text-white">Reset Admin Password</h2>
                  <p className="text-[11px] text-[#8a9aaa]">Set new credentials for {adminToModify.name}</p>
                </div>
              </div>
              <button onClick={() => setResetPassModal(false)} className="text-[#8a9aaa] hover:text-[#18232e]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter secure new password (min 8 chars)..."
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8ee] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setResetPassModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPass}
                  className="px-4 py-2 text-xs font-bold bg-[#0d7c6a] hover:bg-[#0a6355] text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  {resettingPass ? <RefreshCw size={13} className="animate-spin" /> : <KeyRound size={13} />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
