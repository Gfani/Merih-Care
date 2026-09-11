import React, { useState, useEffect } from "react";
import { SearchBar, Card, DataTable, StatusBadge, SkeletonCard, Button, Modal, Select, toast } from "../components/ui";
import { api } from "../services/api";
import { Appointment } from "../types";
import {
  Calendar as CalendarIcon, Clock, MapPin, UserCheck, ShieldAlert,
  Phone, ChevronLeft, ChevronRight, Plus, UserPlus, Sparkles, Check, RefreshCw
} from "lucide-react";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";

export default function AppointmentsSection() {
  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);

  // Status Lifecycle Update Modal
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<Appointment["status"]>("completed");
  const [statusReason, setStatusReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // Scheduling Modal
  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [schedPatientName, setSchedPatientName] = useState("");
  const [schedPatientPhone, setSchedPatientPhone] = useState("");
  const [schedProviderId, setSchedProviderId] = useState("");
  const [schedService, setSchedService] = useState("Doctor Home Visit");
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split("T")[0]);
  const [schedTime, setSchedTime] = useState("10:00");
  const [schedLocation, setSchedLocation] = useState("Addis Ababa, Bole Subcity");
  const [schedAmount, setSchedAmount] = useState("800");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const loadData = async () => {
    setLoading(true);
    try {
      const [aptData, provData] = await Promise.all([
        api.getAppointments().catch(() => []),
        api.getProviders().catch(() => []),
      ]);
      setAppointments(Array.isArray(aptData) ? aptData : (aptData as any)?.data || []);
      setProviders(Array.isArray(provData) ? provData : (provData as any)?.data || []);
    } catch {
      setAppointments([]);
      toast("Failed to load appointments from server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      api.getAppointments()
        .then((data) => {
          setAppointments(Array.isArray(data) ? data : (data as any)?.data || []);
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Real-time socket events for immediate service request and appointment updates
  useRealtimeSocket({
    new_service_request: (data: any) => {
      const apt = data?.data || data;
      if (apt?.appointmentId || apt?.id) {
        const id = apt.appointmentId || apt.id;
        setAppointments((prev) => [{ ...apt, id }, ...prev.filter((a) => a.id !== id)]);
      } else {
        loadData();
      }
    },
    appointment_status_update: (data: any) => {
      const apt = data?.data || data;
      const targetId = apt?.appointmentId || apt?.id;
      if (targetId) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === targetId ? { ...a, ...apt, id: targetId } : a))
        );
      } else {
        loadData();
      }
    },
  });

  const handleUpdateStatus = async () => {
    if (!selectedApt) return;
    const targetId = selectedApt.id;
    // Optimistic status update
    setAppointments((prev) =>
      prev.map((a) => (a.id === targetId ? { ...a, status: newStatus } : a))
    );
    setUpdating(true);
    try {
      await api.updateAppointmentStatus(targetId, newStatus, statusReason);
      toast(`Appointment #${targetId} updated to ${newStatus}`, "success");
      setStatusModal(false);
      setStatusReason("");
    } catch {
      toast("Failed to update appointment status.", "error");
      loadData();
    } finally {
      setUpdating(false);
    }
  };

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedPatientName || !schedDate || !schedTime || !schedLocation) {
      toast("Please fill in patient name, date, time, and care location", "warning");
      return;
    }
    setScheduling(true);
    try {
      const selectedProv = providers.find((p) => p.id === schedProviderId);
      await api.createAppointment({
        patientName: schedPatientName,
        patientPhone: schedPatientPhone,
        providerId: schedProviderId || undefined,
        providerName: selectedProv?.name || "Assigned Specialist",
        providerPhone: selectedProv?.phone || (selectedProv as any)?.user?.phone,
        serviceId: "srv-home-visit",
        service: schedService,
        date: schedDate,
        time: schedTime,
        location: schedLocation,
        amount: Number(schedAmount) || 800,
        status: schedProviderId ? "accepted" : "requested",
      });

      toast(`Appointment scheduled successfully for ${schedPatientName}!`, "success");
      setScheduleModal(false);
      setSchedPatientName("");
      setSchedPatientPhone("");
      loadData();
    } catch (err: any) {
      toast(err.response?.data?.message || err.message || "Failed to schedule appointment", "error");
    } finally {
      setScheduling(false);
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedCalendarDate(today.toISOString().split("T")[0]);
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

  // Calendar calculations
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Group appointments by date
  const appointmentsByDate: Record<string, Appointment[]> = {};
  for (const apt of aptList) {
    if (!apt.date) continue;
    // Normalize date to YYYY-MM-DD
    let d = apt.date.trim();
    if (!appointmentsByDate[d]) appointmentsByDate[d] = [];
    appointmentsByDate[d].push(apt);
  }

  const selectedDayApts = appointmentsByDate[selectedCalendarDate] || [];

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#e2e8ee] dark:border-slate-700">
            <button
              onClick={() => setTab("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                tab === "list"
                  ? "bg-[#0d7c6a] text-white shadow-sm"
                  : "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f0f4f7] dark:hover:bg-slate-700"
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setTab("calendar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 ${
                tab === "calendar"
                  ? "bg-[#0d7c6a] text-white shadow-sm"
                  : "text-[#4a5a6a] dark:text-slate-300 hover:bg-[#f0f4f7] dark:hover:bg-slate-700"
              }`}
            >
              <CalendarIcon size={14} />
              Calendar View
            </button>
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
              { value: "searching", label: "Searching Provider" },
              { value: "requested", label: "Requested" },
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
            className="w-44"
          />
        </div>

        <button
          onClick={() => setScheduleModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0d7c6a] hover:bg-[#0a6355] text-white rounded-xl font-bold text-xs shadow-sm transition-all shrink-0 active:scale-95"
        >
          <Plus size={15} />
          + Schedule Appointment
        </button>
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
                  {
                    key: "patientName",
                    header: "Patient",
                    render: (row) => (
                      <div>
                        <div className="font-semibold text-xs text-[#18232e] dark:text-white">{row.patientName}</div>
                        {row.patientPhone && (
                          <span className="text-[10px] text-[#8a9aaa] block font-mono">{row.patientPhone}</span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "providerName",
                    header: "Assigned Provider & Contact",
                    render: (row) => {
                      const matchedProv = providers.find(
                        (p) =>
                          (row.providerId && (p.id === row.providerId || p.userId === row.providerId)) ||
                          (row.providerName && p.name && p.name.trim().toLowerCase() === row.providerName.trim().toLowerCase())
                      );
                      const displayPhone =
                        row.providerPhone ||
                        matchedProv?.phone ||
                        (matchedProv as any)?.user?.phone ||
                        "";
                      return (
                        <div className="space-y-1">
                          <div className="font-semibold text-xs text-[#18232e] dark:text-white">
                            {row.providerName || matchedProv?.name || "Unassigned"}
                          </div>
                          {displayPhone ? (
                            <a
                              href={`tel:${displayPhone.replace(/\s+/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#0d7c6a] dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                              title={`Call provider ${row.providerName || displayPhone}`}
                            >
                              <Phone size={10} />
                              <span>{displayPhone}</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-[#8a9aaa] italic">No phone listed</span>
                          )}
                        </div>
                      );
                    },
                  },
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
        /* Working Interactive Calendar View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid (2 cols) */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#18232e] dark:text-white">
                    {monthName} {year}
                  </h2>
                  <span className="text-xs text-[#8a9aaa] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full font-semibold">
                    {aptList.length} Total Visits
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={goToToday}
                    className="px-2.5 py-1 text-xs font-bold border border-[#e2e8ee] dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-[#4a5a6a] dark:text-slate-300"
                  >
                    Today
                  </button>
                  <button
                    onClick={prevMonth}
                    className="p-1.5 border border-[#e2e8ee] dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-[#4a5a6a] dark:text-slate-300"
                    title="Previous Month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 border border-[#e2e8ee] dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-[#4a5a6a] dark:text-slate-300"
                    title="Next Month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day names header */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[#8a9aaa]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {/* Previous month padding days */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => {
                  const dayNum = daysInPrevMonth - firstDayOfWeek + idx + 1;
                  return (
                    <div
                      key={`prev-${idx}`}
                      className="min-h-[72px] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-1.5 text-left opacity-40 bg-slate-50/50 dark:bg-slate-900/30"
                    >
                      <span className="text-[10px] font-semibold text-slate-400">{dayNum}</span>
                    </div>
                  );
                })}

                {/* Current month days */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const monthFormatted = String(month + 1).padStart(2, "0");
                  const dayFormatted = String(dayNum).padStart(2, "0");
                  const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;

                  const dayAppointments = appointmentsByDate[dateStr] || [];
                  const count = dayAppointments.length;
                  const isSelected = selectedCalendarDate === dateStr;
                  const isToday =
                    new Date().getDate() === dayNum &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;

                  return (
                    <div
                      key={`curr-${dayNum}`}
                      onClick={() => setSelectedCalendarDate(dateStr)}
                      className={`min-h-[72px] rounded-xl border p-1.5 text-left flex flex-col justify-between cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#0d7c6a] ring-2 ring-[#0d7c6a]/30 bg-emerald-50/40 dark:bg-emerald-950/20"
                          : isToday
                          ? "bg-white dark:bg-slate-800 border-[#0d7c6a] shadow-sm"
                          : "bg-white dark:bg-slate-800 border-[#e2e8ee] dark:border-slate-700 hover:border-slate-400"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center ${
                            isToday
                              ? "bg-[#0d7c6a] text-white"
                              : "text-[#18232e] dark:text-slate-200"
                          }`}
                        >
                          {dayNum}
                        </span>
                        {count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-[#0d7c6a] text-white">
                            {count}
                          </span>
                        )}
                      </div>

                      {count > 0 ? (
                        <div className="space-y-1 mt-1">
                          <span className="text-[9px] bg-[#e6f5f2] dark:bg-emerald-950/50 text-[#0d7c6a] dark:text-emerald-300 font-bold rounded px-1.5 py-0.5 block truncate">
                            {count === 1 ? dayAppointments[0].service : `${count} Care Visits`}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Selected Date Appointments Sidebar (1 col) */}
          <div className="lg:col-span-1">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8ee] dark:border-slate-700">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#8a9aaa]">Schedule for Date</h3>
                  <p className="text-sm font-extrabold text-[#18232e] dark:text-white">{selectedCalendarDate}</p>
                </div>
                <button
                  onClick={() => {
                    setSchedDate(selectedCalendarDate);
                    setScheduleModal(true);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-[#0d7c6a] text-white rounded-lg hover:bg-[#0a6355] flex items-center gap-1 shadow-sm"
                >
                  <Plus size={12} />
                  Book Date
                </button>
              </div>

              {selectedDayApts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <CalendarIcon size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-bold text-[#4a5a6a] dark:text-slate-300">No visits scheduled</p>
                  <p className="text-[11px] text-[#8a9aaa]">No care appointments booked for this date yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {selectedDayApts.map((apt) => (
                    <div
                      key={apt.id}
                      className="p-3.5 rounded-xl border border-[#e2e8ee] dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-900/60 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#0d7c6a]">{apt.time}</span>
                        <StatusBadge status={apt.status as any} />
                      </div>

                      <div>
                        <p className="font-bold text-[#18232e] dark:text-white">{apt.service}</p>
                        <p className="text-[11px] text-[#4a5a6a] dark:text-slate-300 mt-0.5">
                          Patient: <span className="font-semibold">{apt.patientName}</span>
                          {apt.patientPhone && <span className="font-mono ml-1">({apt.patientPhone})</span>}
                        </p>
                      </div>

                      {/* Provider Contact Section with Call Button */}
                      {(() => {
                        const matchedProv = providers.find(
                          (p) =>
                            (apt.providerId && (p.id === apt.providerId || p.userId === apt.providerId)) ||
                            (apt.providerName && p.name && p.name.trim().toLowerCase() === apt.providerName.trim().toLowerCase())
                        );
                        const provPhone = apt.providerPhone || matchedProv?.phone || (matchedProv as any)?.user?.phone;
                        return (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-[#8a9aaa] uppercase font-bold">Assigned Provider</p>
                              <p className="text-xs font-semibold text-[#18232e] dark:text-white">
                                {apt.providerName || matchedProv?.name || "Unassigned"}
                              </p>
                            </div>

                            {provPhone ? (
                              <a
                                href={`tel:${provPhone.replace(/\s+/g, "")}`}
                                className="px-2.5 py-1 bg-[#0d7c6a] hover:bg-[#0a6355] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                title={`Call Provider ${apt.providerName || provPhone}`}
                              >
                                <Phone size={12} />
                                <span>{provPhone}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-[#8a9aaa] italic">No phone</span>
                            )}
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between pt-1">
                        <span className="font-semibold text-[#4a5a6a] dark:text-slate-300">ETB {apt.amount}</span>
                        <button
                          onClick={() => {
                            setSelectedApt(apt);
                            setNewStatus((apt.status as any) || "completed");
                            setStatusModal(true);
                          }}
                          className="text-[11px] font-bold text-[#0d7c6a] hover:underline"
                        >
                          Update Status &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Schedule New Appointment Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e2e8ee] dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8ee] dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#0d7c6a]/10 text-[#0d7c6a]">
                  <CalendarIcon size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#18232e] dark:text-white">Schedule Care Visit</h2>
                  <p className="text-[11px] text-[#8a9aaa]">Book and dispatch a healthcare provider visit</p>
                </div>
              </div>
              <button onClick={() => setScheduleModal(false)} className="text-[#8a9aaa] hover:text-[#18232e]">
                &times;
              </button>
            </div>

            <form onSubmit={handleScheduleAppointment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={schedPatientName}
                    onChange={(e) => setSchedPatientName(e.target.value)}
                    placeholder="e.g. Sara Tekle"
                    className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Patient Phone</label>
                  <input
                    type="tel"
                    value={schedPatientPhone}
                    onChange={(e) => setSchedPatientPhone(e.target.value)}
                    placeholder="+251 91 123 4567"
                    className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Healthcare Service</label>
                <select
                  value={schedService}
                  onChange={(e) => setSchedService(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                >
                  <option value="Doctor Home Visit">Doctor Home Visit</option>
                  <option value="Home Nursing Care">Home Nursing Care</option>
                  <option value="Physical Therapy">Physical Therapy</option>
                  <option value="Lab Sample Collection">Lab Sample Collection</option>
                  <option value="Emergency Care & Triage">Emergency Care & Triage</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Assign Provider (Optional)</label>
                <select
                  value={schedProviderId}
                  onChange={(e) => setSchedProviderId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                >
                  <option value="">-- Open for Provider Matching / Searching --</option>
                  {providers.map((p) => {
                    const phone = p.phone || p.user?.phone;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.specialty || "Specialist"}) {phone ? `- Tel: ${phone}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Time Slot</label>
                  <input
                    type="time"
                    required
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Care Location Address</label>
                  <input
                    type="text"
                    required
                    value={schedLocation}
                    onChange={(e) => setSchedLocation(e.target.value)}
                    placeholder="Subcity, House Number, Landmark"
                    className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#4a5a6a] dark:text-slate-300 mb-1">Fee (ETB)</label>
                  <input
                    type="number"
                    value={schedAmount}
                    onChange={(e) => setSchedAmount(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#e2e8ee] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#18232e] dark:text-white focus:outline-none focus:border-[#0d7c6a]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8ee] dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setScheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#4a5a6a] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-4 py-2 text-xs font-bold bg-[#0d7c6a] hover:bg-[#0a6355] text-white rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  {scheduling ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                  Schedule Visit
                </button>
              </div>
            </form>
          </div>
        </div>
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
              <div className="flex justify-between items-center">
                <span className="text-[#8a9aaa]">Provider:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{selectedApt.providerName}</span>
                  {(() => {
                    const matchedProv = providers.find(
                      (p) =>
                        (selectedApt.providerId && (p.id === selectedApt.providerId || p.userId === selectedApt.providerId)) ||
                        (selectedApt.providerName && p.name && p.name.trim().toLowerCase() === selectedApt.providerName.trim().toLowerCase())
                    );
                    const modalProvPhone = selectedApt.providerPhone || matchedProv?.phone || (matchedProv as any)?.user?.phone;
                    return modalProvPhone ? (
                      <a
                        href={`tel:${modalProvPhone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0d7c6a] hover:underline"
                        title={`Call ${selectedApt.providerName || modalProvPhone}`}
                      >
                        <Phone size={10} /> Call ({modalProvPhone})
                      </a>
                    ) : (
                      <span className="text-[10px] text-[#8a9aaa] italic">(No phone on file)</span>
                    );
                  })()}
                </div>
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
