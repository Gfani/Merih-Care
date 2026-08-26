import React, { useState, useEffect } from "react";
import { SearchBar, Card, DataTable, StatusBadge, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { toast } from "../components/ui/toast";

export default function AppointmentsSection() {
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic monthly calendar state
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 25)); // Initialize near mock data (Aug 25, 2026)

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments();
      setAppointments(data);
    } catch {
      toast("Failed to load appointments", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const filteredAppointments = appointments.filter(apt => {
    const pName = apt.patientName || "";
    const prName = apt.providerName || "";
    const sName = apt.service || "";
    return pName.toLowerCase().includes(search.toLowerCase()) ||
      prName.toLowerCase().includes(search.toLowerCase()) ||
      sName.toLowerCase().includes(search.toLowerCase());
  });

  // Generate calendar days
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const gridCells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    gridCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push(d);
  }
  while (gridCells.length % 7 !== 0) {
    gridCells.push(null);
  }

  const isToday = (dayNum: number | null) => {
    if (!dayNum) return false;
    return dayNum === 25 && month === 7 && year === 2026;
  };

  const hasApt = (dayNum: number | null) => {
    if (!dayNum) return false;
    const formattedDay = dayNum.toString().padStart(2, "0");
    const formattedMonth = (month + 1).toString().padStart(2, "0");
    const yyyymmdd = `${year}-${formattedMonth}-${formattedDay}`;

    const monthAbbrev = monthName.slice(0, 3);
    const dateStr = `${monthAbbrev} ${dayNum}, ${year}`;

    return appointments.some(apt => apt.date === yyyymmdd || apt.date === dateStr);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {["list", "calendar"].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                tab === t ? "bg-[#0d7c6a] text-white" : "bg-white dark:bg-slate-800 text-[#4a5a6a] border border-[#e2e8ee]"
              }`}
            >
              {t === "list" ? "List View" : "Calendar View"}
            </button>
          ))}
        </div>
        <SearchBar placeholder="Search appointments..." value={search} onChange={setSearch} className="flex-1 min-w-[200px]" />
      </div>

      {tab === "list" ? (
        <Card>
          {loading ? (
            <div className="p-6 space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "id", header: "ID", render: (row) => <span className="text-xs font-mono text-[#8a9aaa]">{row.id as string}</span> },
                { key: "patientName", header: "Patient" },
                { key: "providerName", header: "Provider" },
                { key: "service", header: "Service" },
                { key: "date", header: "Date/Time", render: (row) => <span className="text-xs">{row.date as string} {row.time as string}</span> },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
                { key: "paymentStatus", header: "Payment", render: (row) => <StatusBadge status={row.paymentStatus === "paid" ? "completed" : row.paymentStatus as any} /> },
              ]}
              data={filteredAppointments as any}
            />
          )}
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[#18232e]">{monthName} {year}</h3>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded">
                &larr; Prev
              </button>
              <button onClick={handleNextMonth} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded">
                Next &rarr;
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-[#8a9aaa] py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((day, i) => {
              const active = isToday(day);
              const appointmentScheduled = hasApt(day);
              return (
                <div
                  key={i}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative ${
                    day === null
                      ? "opacity-0 pointer-events-none"
                      : active
                      ? "bg-[#0d7c6a] text-white"
                      : "hover:bg-[#f0f4f7] cursor-pointer"
                  }`}
                >
                  {day !== null && (
                    <>
                      <span className={`text-xs font-medium ${active ? "text-white" : "text-[#18232e]"}`}>{day}</span>
                      {appointmentScheduled && (
                        <span className={`w-1 h-1 rounded-full absolute bottom-1.5 ${active ? "bg-white" : "bg-[#0d7c6a]"}`} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
