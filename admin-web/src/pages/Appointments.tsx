import React, { useState, useEffect } from "react";
import { SearchBar, Card, DataTable, StatusBadge, SkeletonCard, Button, Modal, Select, toast } from "../components/ui";
import { api } from "../services/api";
import { Appointment } from "../types";
import { Calendar as CalendarIcon, Clock, MapPin, UserCheck, ShieldAlert } from "lucide-react";

export default function AppointmentsSection() {
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Status Lifecycle Update Modal
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<Appointment["status"]>("completed");
  const [statusReason, setStatusReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Calendar
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 25));
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments();
      setAppointments(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch {
      setAppointments([]);
      toast("Failed to load appointments from server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async () => {
    if (!selectedApt) return;
    setUpdating(true);
    try {
      await api.updateAppointmentStatus(selectedApt.id, newStatus, statusReason);
      toast(`Appointment #${selectedApt.id} updated to ${newStatus}`, "success");
      setStatusModal(false);
      setStatusReason("");
      loadData();
    } catch {
      toast("Failed to update appointment status.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const aptList = Array.isArray(appointments) ? appointments : [];
  const filtered = aptList.filter((apt) => {
    const pName = apt.patientName || "";
    const prName = apt.providerName || "";
    const sName = apt.service || "";
    const matchSearch =
      pName.toLowerCase().includes(search.toLowerCase()) ||
      prName.toLowerCase().includes(search.toLowerCase()) ||
      sName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || apt.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#e2e8ee] dark:border-slate-700">
            {["list", "calendar"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  tab === t
                    ? "bg-[#0d7c6a] text-white"
                    : "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f0f4f7] dark:hover:bg-slate-700"
                }`}
              >
                {t === "list" ? "List View" : "Calendar View"}
              </button>
            ))}
          </div>

          <SearchBar
            placeholder="Search by patient, provider, service..."
            value={search}
            onChange={setSearch}
            className="flex-1 min-w-[200px]"
          />

          <Select
            label=""
            options={[
              { value: "all", label: "All Status" },
              { value: "scheduled", label: "Scheduled" },
              { value: "accepted", label: "Accepted" },
              { value: "on_the_way", label: "On The Way" },
              { value: "arrived", label: "Arrived" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36"
          />
        </div>
      </div>

      {tab === "list" ? (
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
                    header: "Apt ID",
                    render: (row) => <span className="text-xs font-mono font-bold text-[#0d7c6a]">{row.id}</span>,
                  },
                  { key: "service", header: "Service" },
                  { key: "patientName", header: "Patient" },
                  { key: "providerName", header: "Assigned Provider" },
                  {
                    key: "schedule",
                    header: "Scheduled",
                    render: (row) => (
                      <span className="text-xs text-[#4a5a6a] dark:text-slate-300">
                        {row.date} · {row.time}
                      </span>
                    ),
                  },
                  {
                    key: "amount",
                    header: "Fee",
                    render: (row) => <span className="font-semibold text-xs">ETB {row.amount}</span>,
                  },
                  { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (row) => (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedApt(row as Appointment);
                          setNewStatus((row.status as any) || "completed");
                          setStatusModal(true);
                        }}
                      >
                        Manage Status
                      </Button>
                    ),
                  },
                ]}
                data={paginated}
              />

              {/* Pagination footer */}
              <div className="p-4 border-t border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between text-xs text-[#8a9aaa]">
                <span>
                  Showing {paginated.length} of {filtered.length} appointments
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
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-[#18232e] dark:text-white">
              {monthName} {year}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
                Previous
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
                Next
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="font-bold text-[#8a9aaa] py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: 35 }).map((_, idx) => {
              const day = idx - 2;
              const isCurrent = day > 0 && day <= 31;
              return (
                <div
                  key={idx}
                  className={`h-16 rounded-xl border p-1 text-left flex flex-col justify-between ${
                    isCurrent
                      ? "bg-white dark:bg-slate-800 border-[#e2e8ee] dark:border-slate-700"
                      : "bg-[#f8fafc] dark:bg-slate-800/50 border-transparent text-[#cbd5e1]"
                  }`}
                >
                  <span className="text-[10px] font-bold text-[#8a9aaa]">{isCurrent ? day : ""}</span>
                  {isCurrent && (day === 25 || day === 28 || day === 30) && (
                    <span className="text-[9px] bg-[#e6f5f2] text-[#0d7c6a] font-bold rounded px-1 truncate">
                      {day === 25 ? "3 Visits" : "2 Visits"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Appointment Status Lifecycle Modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Manage Appointment Lifecycle">
        {selectedApt && (
          <div className="space-y-4 text-sm">
            <div className="bg-[#f8fafc] dark:bg-slate-700/50 p-4 rounded-xl border border-[#e2e8ee] dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8a9aaa]">Appointment ID:</span>
                <span className="font-bold text-[#0d7c6a] font-mono">{selectedApt.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8a9aaa]">Patient:</span>
                <span className="font-bold">{selectedApt.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8a9aaa]">Provider:</span>
                <span className="font-bold">{selectedApt.providerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8a9aaa]">Current Status:</span>
                <StatusBadge status={selectedApt.status as any} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Set New Lifecycle Status:</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full border border-[#e2e8ee] dark:border-slate-600 rounded-lg p-2 text-xs dark:bg-slate-700 font-semibold"
              >
                <option value="requested">Requested (Unassigned)</option>
                <option value="accepted">Accepted by Provider</option>
                <option value="on_the_way">On The Way (En Route)</option>
                <option value="arrived">Arrived at Patient Home</option>
                <option value="in_progress">Care In Progress</option>
                <option value="completed">Completed & Settled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Status Update Note / Reason:</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Administrative status override per clinical call center update."
                className="w-full border border-[#e2e8ee] dark:border-slate-600 rounded-lg p-2 text-xs h-16 dark:bg-slate-700"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setStatusModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleUpdateStatus} loading={updating}>
                Save Status Transition
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
