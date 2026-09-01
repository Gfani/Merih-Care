import React, { useState, useEffect } from "react";
import { StatCard, SearchBar, Card, DataTable, StatusBadge, SkeletonCard, Button, Modal, ConfirmDialog, Select, toast } from "../components/ui";
import { Column } from "../components/ui/data-display";
import { api } from "../services/api";
import { RefreshCw, CheckCircle2, XCircle, Banknote, Layers } from "lucide-react";

export default function PayoutsSection() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Actions state
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [actionModal, setActionModal] = useState<"approve" | "reject" | null>(null);
  const [batchModal, setBatchModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [txRefInput, setTxRefInput] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getPayouts();
      setPayouts(data || []);
    } catch {
      toast("Failed to load payout requests", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "completed" | "failed") => {
    setProcessing(true);
    try {
      await api.updatePayoutStatus(id, newStatus, txRefInput || undefined);
      toast(`Payout marked as ${newStatus}`, "success");
      setActionModal(null);
      setSelectedPayout(null);
      setTxRefInput("");
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || `Failed to update payout status`, "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleBatchSettle = async () => {
    setProcessing(true);
    try {
      const result = await api.createBatchSettlement();
      toast(`Batch settlement processed: ${result.totalPayouts || 0} payouts (${result.totalAmount || 0} ETB)`, "success");
      setBatchModal(false);
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || "Batch settlement failed", "error");
    } finally {
      setProcessing(false);
    }
  };

  const filtered = payouts.filter((p) => {
    const provId = p.providerId || "";
    const pId = p.id || "";
    const bank = p.bankAccount || "";
    const ref = p.transactionReference || "";
    const matchSearch =
      provId.toLowerCase().includes(search.toLowerCase()) ||
      pId.toLowerCase().includes(search.toLowerCase()) ||
      bank.toLowerCase().includes(search.toLowerCase()) ||
      ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: payouts.length,
    pending: payouts.filter((p) => p.status === "pending").length,
    completed: payouts.filter((p) => p.status === "completed").length,
    pendingAmount: payouts
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    totalSettledAmount: payouts
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
  };

  const columns: Column<any>[] = [
    {
      key: "id",
      header: "Payout ID",
      render: (p: any) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          {p.id}
        </span>
      ),
    },
    {
      key: "providerId",
      header: "Provider ID",
      render: (p: any) => <span className="font-medium">{p.providerId}</span>,
    },
    {
      key: "amount",
      header: "Amount (ETB)",
      render: (p: any) => (
        <span className="font-bold text-slate-900 dark:text-white">
          {(parseFloat(p.amount) || 0).toLocaleString()} ETB
        </span>
      ),
    },
    {
      key: "bankAccount",
      header: "Bank Account",
      render: (p: any) => <span className="text-xs text-slate-500 dark:text-slate-400">{p.bankAccount || "N/A"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (p: any) => (
        <StatusBadge
          status={
            p.status === "completed"
              ? "completed"
              : p.status === "pending"
              ? "pending"
              : "cancelled"
          }
        />
      ),
    },
    {
      key: "transactionReference",
      header: "Reference",
      render: (p: any) => <span className="font-mono text-xs text-slate-500">{p.transactionReference || "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Date",
      render: (p: any) => <span className="text-xs text-slate-500">{p.createdAt ? p.createdAt.split("T")[0] : "—"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (p: any) => (
        <div className="flex items-center gap-2">
          {p.status === "pending" ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPayout(p);
                  setTxRefInput(p.transactionReference || `BANK-REF-${Date.now()}`);
                  setActionModal("approve");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle2 size={13} />
                Approve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPayout(p);
                  setActionModal("reject");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-md hover:bg-rose-100 transition-colors"
              >
                <XCircle size={13} />
                Reject
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">Processed</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Provider Payouts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage provider earnings, approve withdrawals, and trigger bank batch settlements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => setBatchModal(true)}>
            <Layers size={14} />
            Batch Settlement
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Payouts" value={stats.total} icon={<Banknote size={20} />} />
        <StatCard
          label="Pending Requests"
          value={stats.pending}
          sub={`${stats.pendingAmount.toLocaleString()} ETB pending`}
          icon={<RefreshCw size={20} />}
        />
        <StatCard
          label="Completed Payouts"
          value={stats.completed}
          sub={`${stats.totalSettledAmount.toLocaleString()} ETB settled`}
          icon={<CheckCircle2 size={20} />}
        />
        <StatCard
          label="Total Settled (ETB)"
          value={`${stats.totalSettledAmount.toLocaleString()} ETB`}
          icon={<Banknote size={20} />}
        />
      </div>

      {/* Filters & Table */}
      <Card>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="w-full max-w-sm">
              <SearchBar value={search} onChange={setSearch} placeholder="Search provider, payout ID, bank..." />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "pending", label: "Pending" },
                { value: "completed", label: "Completed" },
                { value: "failed", label: "Failed / Rejected" },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
          />
        )}
      </Card>

      {/* Approve Modal */}
      {actionModal === "approve" && selectedPayout && (
        <Modal
          open={true}
          onClose={() => setActionModal(null)}
          title="Approve Provider Payout"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You are approving a payout of{" "}
              <strong className="text-slate-900 dark:text-white">
                {(parseFloat(selectedPayout.amount) || 0).toLocaleString()} ETB
              </strong>{" "}
              to provider <strong className="text-slate-900 dark:text-white">{selectedPayout.providerId}</strong>.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-xs space-y-1">
              <div><strong>Bank Account:</strong> {selectedPayout.bankAccount || "N/A"}</div>
              <div><strong>Requested Date:</strong> {selectedPayout.createdAt?.split("T")[0] || "—"}</div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Bank Transaction Reference / Cheque No.
              </label>
              <input
                type="text"
                value={txRefInput}
                onChange={(e) => setTxRefInput(e.target.value)}
                placeholder="e.g. CBE-FT2408301928"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setActionModal(null)} disabled={processing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => handleUpdateStatus(selectedPayout.id, "completed")}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm & Mark Completed"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {actionModal === "reject" && selectedPayout && (
        <ConfirmDialog
          open={true}
          onClose={() => setActionModal(null)}
          onConfirm={() => handleUpdateStatus(selectedPayout.id, "failed")}
          title="Reject Payout Request"
          message={`Are you sure you want to reject payout ${selectedPayout.id}? The amount (${(parseFloat(selectedPayout.amount) || 0).toLocaleString()} ETB) will be refunded back to the provider's ledger balance.`}
          confirmLabel={processing ? "Rejecting..." : "Reject Payout"}
          confirmVariant="danger"
        />
      )}

      {/* Batch Settlement Modal */}
      {batchModal && (
        <Modal
          open={true}
          onClose={() => setBatchModal(false)}
          title="Execute Batch Settlement"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Executing batch settlement will aggregate and process all eligible provider balances meeting the minimum payout limit.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setBatchModal(false)} disabled={processing}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleBatchSettle} disabled={processing}>
                {processing ? "Settling..." : "Start Batch Settlement"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
