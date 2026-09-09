import React, { useState, useEffect, useCallback } from "react";
import { SearchBar, Select, Card, DataTable, StatusBadge, SkeletonCard, Button, Modal } from "../components/ui";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";
import { Inbox, Clock, CheckCircle2, AlertCircle, Eye, RefreshCw } from "lucide-react";

export default function RequestsSection() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aptData, reqData] = await Promise.all([
        api.getAppointments().catch(() => []),
        api.getRequests().catch(() => []),
      ]);
      const apts = Array.isArray(aptData) ? aptData : (aptData as any)?.data || [];
      const reqs = Array.isArray(reqData) ? reqData : (reqData as any)?.data || [];

      // Combine and deduplicate by id
      const map = new Map<string, any>();
      for (const item of reqs) {
        if (item?.id) map.set(item.id, item);
      }
      for (const item of apts) {
        if (item?.id) {
          map.set(item.id, { ...map.get(item.id), ...item });
        }
      }
      const combined = Array.from(map.values()).sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date || 0).getTime();
        const timeB = new Date(b.createdAt || b.date || 0).getTime();
        return timeB - timeA;
      });
      setAppointments(combined);
    } catch {
      setAppointments([]);
      console.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRealtimeEvent = useCallback((event: string, payload: any) => {
    if (event === "new_service_request" || event === "appointment_status_update") {
      const data = payload?.data || payload;
      if (data && data.id) {
        setAppointments((prev) => {
          const index = prev.findIndex((p) => p.id === data.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...data };
            return updated;
          }
          return [data, ...prev];
        });
      } else {
        loadData();
      }
    }
  }, [loadData]);

  useRealtimeSocket({ token, onEvent: handleRealtimeEvent });

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(timer);
  }, [loadData]);

  const aptList = Array.isArray(appointments) ? appointments : [];

  // Summary counts
  const totalCount = aptList.length;
  const searchingCount = aptList.filter(
    (r) => r.status === "searching" || r.status === "requested" || r.status === "pending"
  ).length;
  const inProgressCount = aptList.filter(
    (r) => r.status === "scheduled" || r.status === "in_progress" || r.status === "accepted"
  ).length;
  const completedCount = aptList.filter((r) => r.status === "completed").length;

  const filteredRequests = aptList
    .map((a) => ({
      ...a,
      requestId: a.requestId || `REQ-${(a.id || "").toUpperCase().slice(0, 8)}`,
    }))
    .filter((r) => {
      const pName = r.patientName || r.patient?.name || "";
      const sName = r.service || r.serviceType || "";
      const reqId = r.requestId || "";
      const provName = r.providerName || r.provider?.name || "";
      const matchSearch =
        pName.toLowerCase().includes(search.toLowerCase()) ||
        sName.toLowerCase().includes(search.toLowerCase()) ||
        provName.toLowerCase().includes(search.toLowerCase()) ||
        reqId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Metric Cards showing numbers of requests */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Inbox size={20} />
          </div>
          <div>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400 font-medium">Total Requests</p>
            <p className="text-xl font-bold text-[#18232e] dark:text-white">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400 font-medium">Active / Searching</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{searchingCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-[#0d7c6a] dark:text-cyan-400 flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400 font-medium">Scheduled & Active</p>
            <p className="text-xl font-bold text-[#0d7c6a] dark:text-cyan-400">{inProgressCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400 font-medium">Completed</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-center justify-between">
        <div className="flex gap-3 flex-wrap flex-1 min-w-[280px]">
          <SearchBar
            placeholder="Search requests by patient, service, or provider..."
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-[200px]"
          />
          <Select
            label=""
            options={[
              { value: "all", label: "All Status" },
              { value: "searching", label: "Searching Provider" },
              { value: "pending", label: "Pending" },
              { value: "scheduled", label: "Scheduled" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="flex items-center gap-1.5 cursor-pointer text-xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </Button>
      </div>

      <Card>
        {loading && appointments.length === 0 ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "requestId",
                header: "Request ID",
                render: (row: any) => (
                  <span className="text-xs font-mono text-[#8a9aaa]">{row.requestId as string}</span>
                ),
              },
              {
                key: "patientName",
                header: "Patient",
                render: (row: any) => (
                  <span className="font-semibold text-xs text-[#18232e] dark:text-white">
                    {(row.patientName as string) || row.patient?.name || "Patient"}
                  </span>
                ),
              },
              {
                key: "service",
                header: "Service",
                render: (row: any) => (
                  <span className="text-xs">{(row.service as string) || row.serviceType || "General Care"}</span>
                ),
              },
              {
                key: "providerName",
                header: "Provider",
                render: (row: any) => (
                  <span className="text-xs text-[#4a5a6a] dark:text-slate-300">
                    {(row.providerName as string) || row.provider?.name || "Pending Provider Match"}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Date & Time",
                render: (row: any) => (
                  <span className="text-xs text-[#8a9aaa]">
                    {row.date as string} {row.time ? `• ${row.time}` : ""}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row: any) => <StatusBadge status={row.status as any} />,
              },
              {
                key: "amount",
                header: "Amount",
                render: (row: any) => (
                  <span className="font-semibold text-xs text-[#0d7c6a] dark:text-cyan-400">
                    ETB {Number(row.amount || 0).toLocaleString()}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (row: any) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs !py-1 !px-2 flex items-center gap-1 cursor-pointer"
                    onClick={() => {
                      setSelectedRequest(row);
                      setDetailsModalOpen(true);
                    }}
                  >
                    <Eye size={13} />
                    <span>View</span>
                  </Button>
                ),
              },
            ]}
            data={filteredRequests as any}
          />
        )}
      </Card>

      {/* Request Details Modal */}
      <Modal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`Service Request: ${selectedRequest?.requestId || ""}`}
      >
        {selectedRequest && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-[#f8fafc] dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
              <div>
                <p className="text-[10px] text-[#8a9aaa] uppercase font-bold">Service Requested</p>
                <p className="font-bold text-sm text-[#18232e] dark:text-white">
                  {selectedRequest.service || selectedRequest.serviceType || "Clinical Care"}
                </p>
              </div>
              <StatusBadge status={selectedRequest.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-white dark:bg-slate-850 rounded-lg border border-[#e2e8ee] dark:border-slate-700">
              <div>
                <span className="text-[#8a9aaa] font-medium block">Patient:</span>
                <span className="font-semibold text-[#18232e] dark:text-white">
                  {selectedRequest.patientName || selectedRequest.patient?.name || "Patient"}
                </span>
                {selectedRequest.patient?.phone && (
                  <span className="text-[10px] text-[#8a9aaa] block">{selectedRequest.patient.phone}</span>
                )}
              </div>
              <div>
                <span className="text-[#8a9aaa] font-medium block">Assigned Provider:</span>
                <span className="font-semibold text-[#18232e] dark:text-white">
                  {selectedRequest.providerName || selectedRequest.provider?.name || "Awaiting clinician acceptance"}
                </span>
              </div>
              <div>
                <span className="text-[#8a9aaa] font-medium block">Scheduled Date / Time:</span>
                <span className="font-semibold text-[#18232e] dark:text-white">
                  {selectedRequest.date || "Today"} {selectedRequest.time || ""}
                </span>
              </div>
              <div>
                <span className="text-[#8a9aaa] font-medium block">Consultation Fee:</span>
                <span className="font-bold text-[#0d7c6a] dark:text-cyan-400">
                  ETB {Number(selectedRequest.amount || 0).toLocaleString()}
                </span>
              </div>
              {selectedRequest.address && (
                <div className="col-span-2 border-t border-[#e2e8ee] dark:border-slate-700 pt-2">
                  <span className="text-[#8a9aaa] font-medium block">Visit Address:</span>
                  <span className="text-[#18232e] dark:text-white font-medium">{selectedRequest.address}</span>
                </div>
              )}
              {selectedRequest.visitNotes && (
                <div className="col-span-2 border-t border-[#e2e8ee] dark:border-slate-700 pt-2">
                  <span className="text-[#8a9aaa] font-medium block">Visit & Medical Notes:</span>
                  <span className="text-[#18232e] dark:text-white">{selectedRequest.visitNotes}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

