import React, { useState, useEffect } from "react";
import { StatCard, SearchBar, Card, DataTable, StatusBadge, SkeletonCard, Button, Modal, ConfirmDialog, Select, toast } from "../components/ui";
import { api } from "../services/api";
import { PaymentTransaction } from "../types";
import { Download, RefreshCw, Receipt, RotateCcw } from "lucide-react";

export default function PaymentsSection() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Drawer & Refund Modal State
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getTransactions();
      setTransactions(data || []);
    } catch {
      toast("Failed to load payment transactions from backend", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = transactions.filter((t) => {
    const pName = t.patientName || "";
    const provName = t.providerName || "";
    const txId = t.transactionRef || t.id || "";
    const matchSearch =
      pName.toLowerCase().includes(search.toLowerCase()) ||
      provName.toLowerCase().includes(search.toLowerCase()) ||
      txId.toLowerCase().includes(search.toLowerCase());
    const matchMethod = methodFilter === "all" || t.paymentMethod === methodFilter;
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchMethod && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const stats = {
    total: transactions.length,
    successful: transactions.filter((t) => t.status === "completed").length,
    refunded: transactions.filter((t) => t.status === "refunded").length,
    revenue: transactions.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.amount || 0), 0),
    platformCommission: transactions.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.platformFee || t.amount * 0.15), 0),
  };

  const handleRefundSubmit = async () => {
    if (!selectedTx) return;
    setProcessingRefund(true);
    try {
      await api.processRefund(selectedTx.id, selectedTx.amount, refundReason || "Customer requested refund");
      toast(`Refund of ETB ${selectedTx.amount} processed successfully`, "success");
      setRefundModal(false);
      setDetailModal(false);
      setRefundReason("");
      loadData();
    } catch {
      toast("Refund failed. Check backend payment gateway.", "error");
    } finally {
      setProcessingRefund(false);
    }
  };

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Transaction Ref", "Patient", "Provider", "Gross Amount", "Platform Fee", "Net Payout", "Method", "Status", "Date"].join(",");
    const rows = filtered.map((t) => [
      t.transactionRef || t.id,
      `"${t.patientName}"`,
      `"${t.providerName}"`,
      t.amount,
      t.platformFee || t.amount * 0.15,
      t.providerPayout || t.amount * 0.85,
      t.paymentMethod,
      t.status,
      t.createdAt,
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `merihcare_payments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Payments CSV downloaded", "success");
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Transactions" value={loading ? "..." : stats.total} />
        <StatCard label="Completed" value={loading ? "..." : stats.successful} color="#16a34a" />
        <StatCard label="Refunded / Disputes" value={loading ? "..." : stats.refunded} color="#dc2626" />
        <StatCard label="Platform Earnings (15%)" value={loading ? "..." : `ETB ${stats.platformCommission.toLocaleString()}`} color="#0d7c6a" />
      </div>

      <div className="flex gap-3 items-center justify-between flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <SearchBar
            placeholder="Search by transaction ID, patient, or provider..."
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-[200px]"
          />
          <Select
            label=""
            options={[
              { value: "all", label: "All Methods" },
              { value: "telebirr", label: "Telebirr" },
              { value: "cbe_birr", label: "CBE Birr" },
              { value: "chapa", label: "Chapa" },
              { value: "cash", label: "Cash" },
            ]}
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-32"
          />
          <Select
            label=""
            options={[
              { value: "all", label: "All Status" },
              { value: "completed", label: "Completed" },
              { value: "pending", label: "Pending" },
              { value: "refunded", label: "Refunded" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-32"
          />
        </div>

        <Button variant="outline" onClick={handleExportCSV} className="flex items-center gap-2">
          <Download size={15} />
          <span>Export CSV</span>
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: "id",
                  header: "Ref / Tx ID",
                  render: (row) => (
                    <span className="text-xs font-mono text-[#0d7c6a] font-bold">
                      {row.transactionRef || row.id}
                    </span>
                  ),
                },
                { key: "patientName", header: "Patient" },
                { key: "providerName", header: "Provider" },
                {
                  key: "amount",
                  header: "Gross Amount",
                  render: (row) => (
                    <span className="font-semibold text-xs text-[#18232e] dark:text-white">
                      ETB {(row.amount as number).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: "method",
                  header: "Method",
                  render: (row) => (
                    <span className="text-xs uppercase bg-[#f0f4f7] dark:bg-slate-700 px-2 py-0.5 rounded-full font-semibold">
                      {row.paymentMethod || "telebirr"}
                    </span>
                  ),
                },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
                {
                  key: "createdAt",
                  header: "Date",
                  render: (row) => (
                    <span className="text-xs text-[#8a9aaa]">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "2026-08-29"}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (row) => (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTx(row as PaymentTransaction);
                        setDetailModal(true);
                      }}
                    >
                      Inspect
                    </Button>
                  ),
                },
              ]}
              data={paginated}
            />

            {/* Pagination footer */}
            <div className="p-4 border-t border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between text-xs text-[#8a9aaa]">
              <span>
                Showing {paginated.length} of {filtered.length} transactions
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 font-semibold text-[#18232e] dark:text-white">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Transaction Detail Drawer Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title="Payment Settlement Details">
        {selectedTx && (
          <div className="space-y-4 text-sm">
            <div className="bg-[#f8fafc] dark:bg-slate-700/50 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8a9aaa]">Transaction Ref:</span>
                <span className="font-mono font-bold text-xs text-[#0d7c6a]">{selectedTx.transactionRef || selectedTx.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8a9aaa]">Status:</span>
                <StatusBadge status={selectedTx.status as any} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8a9aaa]">Payment Channel:</span>
                <span className="font-bold text-xs uppercase">{selectedTx.paymentMethod || "Telebirr"}</span>
              </div>
            </div>

            <div className="border border-[#e2e8ee] dark:border-slate-700 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-[#18232e] dark:text-white uppercase tracking-wide">Financial Settlement Split</p>
              <div className="flex justify-between text-xs">
                <span className="text-[#8a9aaa]">Gross Billed Amount:</span>
                <span className="font-bold text-[#18232e] dark:text-white">ETB {selectedTx.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#8a9aaa]">Platform Commission (15%):</span>
                <span className="font-bold text-[#0d7c6a]">
                  ETB {(selectedTx.platformFee || selectedTx.amount * 0.15).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-[#e2e8ee] dark:border-slate-700">
                <span className="text-[#8a9aaa]">Provider Net Payout (85%):</span>
                <span className="font-bold text-[#18232e] dark:text-white">
                  ETB {(selectedTx.providerPayout || selectedTx.amount * 0.85).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              {selectedTx.status === "completed" && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setRefundModal(true)}
                  className="flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  <span>Initiate Refund</span>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDetailModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Initiation Modal */}
      <Modal open={refundModal} onClose={() => setRefundModal(false)} title="Process Customer Refund">
        {selectedTx && (
          <div className="space-y-4 text-sm">
            <div className="bg-[#fee2e2] text-[#991b1b] p-3 rounded-lg text-xs">
              Warning: This will refund <strong>ETB {selectedTx.amount}</strong> back to the patient via{" "}
              {selectedTx.paymentMethod?.toUpperCase()} and debit the provider ledger.
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-[#18232e] dark:text-white">
                Refund Reason / Audit Note:
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Appointment cancelled by provider on arrival; clinical dispute resolved."
                className="w-full border border-[#e2e8ee] rounded-lg p-2 text-xs h-20 dark:bg-slate-700 dark:border-slate-600"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setRefundModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRefundSubmit}
                loading={processingRefund}
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
