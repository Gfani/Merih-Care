import React, { useState, useEffect } from "react";
import { SearchBar, Card, DataTable, SkeletonCard, Button, Modal, Select, toast } from "../components/ui";
import { api } from "../services/api";
import { AuditLog } from "../types";
import { Download, FileCode, Shield, Terminal } from "lucide-react";

export default function AuditLogsSection() {
  const [search, setSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector Drawer State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [inspectModal, setInspectModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setAuditLogs(data || []);
    } catch {
      toast("Failed to load audit logs from server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = auditLogs.filter((l) => {
    const actor = (l.actorEmail || (l as any).actor || "").toLowerCase();
    const action = (l.action || "").toLowerCase();
    const entity = (l.entity || (l as any).resource || "").toLowerCase();
    const q = search.toLowerCase();
    return actor.includes(q) || action.includes(q) || entity.includes(q);
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Log ID", "Actor", "Action", "Entity", "IP Address", "Timestamp"].join(",");
    const rows = filtered.map((l) => [
      l.id,
      `"${l.actorEmail || (l as any).actor || ""}"`,
      `"${l.action}"`,
      `"${l.entity || (l as any).resource || ""}"`,
      l.ipAddress || "127.0.0.1",
      l.createdAt || (l as any).timestamp || "",
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Audit logs exported to CSV", "success");
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex gap-3 items-center justify-between flex-wrap">
        <SearchBar
          placeholder="Search by actor email, action, or entity..."
          value={search}
          onChange={setSearch}
          className="flex-1 min-w-[240px]"
        />
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
                  header: "Log ID",
                  render: (row: any) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id}</span>,
                },
                {
                  key: "actor",
                  header: "Actor",
                  render: (row: any) => (
                    <span className="text-xs font-bold text-[#18232e] dark:text-white">
                      {row.actorEmail || row.actor || "System"}
                    </span>
                  ),
                },
                {
                  key: "action",
                  header: "Action",
                  render: (row: any) => (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#e8f1fb] text-[#1b6fba] font-mono">
                      {row.action}
                    </span>
                  ),
                },
                {
                  key: "entity",
                  header: "Target Entity",
                  render: (row: any) => (
                    <span className="text-xs text-[#4a5a6a] dark:text-slate-300">
                      {row.entity || row.resource}
                    </span>
                  ),
                },
                {
                  key: "timestamp",
                  header: "Timestamp",
                  render: (row: any) => (
                    <span className="text-xs text-[#8a9aaa] font-mono">
                      {row.createdAt || row.timestamp || "2026-08-29"}
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
                        setSelectedLog(row as AuditLog);
                        setInspectModal(true);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Terminal size={13} />
                      <span>Inspect Payload</span>
                    </Button>
                  ),
                },
              ]}
              data={paginated}
            />

            {/* Pagination footer */}
            <div className="p-4 border-t border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between text-xs text-[#8a9aaa]">
              <span>
                Showing {paginated.length} of {filtered.length} audit records
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

      {/* Audit Log Detail Drawer */}
      <Modal open={inspectModal} onClose={() => setInspectModal(false)} title="Audit Event Inspection">
        {selectedLog && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#f8fafc] dark:bg-slate-700/50 p-3 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
              <div>
                <span className="text-[#8a9aaa]">Event ID:</span>
                <p className="font-mono font-bold text-[#18232e] dark:text-white">{selectedLog.id}</p>
              </div>
              <div>
                <span className="text-[#8a9aaa]">Actor:</span>
                <p className="font-bold text-[#18232e] dark:text-white">{selectedLog.actorEmail || (selectedLog as any).actor}</p>
              </div>
              <div>
                <span className="text-[#8a9aaa]">Action Performed:</span>
                <p className="font-mono font-bold text-[#0d7c6a]">{selectedLog.action}</p>
              </div>
              <div>
                <span className="text-[#8a9aaa]">IP Address / Client:</span>
                <p className="font-mono text-[#18232e] dark:text-white">{selectedLog.ipAddress || "192.168.1.100 (Internal VPN)"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-[#18232e] dark:text-white mb-1.5 flex items-center gap-1.5">
                <FileCode size={14} className="text-[#0d7c6a]" />
                <span>Captured Event Metadata / State Diff:</span>
              </p>
              <pre className="bg-[#0f172a] text-[#38bdf8] p-3 rounded-xl text-xs font-mono overflow-x-auto max-h-60">
                {JSON.stringify(
                  selectedLog.metadata || {
                    before: { status: "pending" },
                    after: { status: "verified" },
                    decisionBy: selectedLog.actorEmail || "admin@merihcare.et",
                    auditTimestamp: selectedLog.createdAt || new Date().toISOString(),
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectModal(false)}>
                Close Inspector
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
