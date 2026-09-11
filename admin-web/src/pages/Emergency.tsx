import React, { useState, useEffect } from "react";
import { Alert, Card, Button, Modal, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { AlertTriangle, MapPin, Clock, ShieldAlert, CheckCircle2, Siren, UserRound } from "lucide-react";
import { useRealtimeSocket } from "../hooks/useRealtimeSocket";

export default function EmergencySection() {
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmergency, setSelectedEmergency] = useState<any | null>(null);
  const [dispatchModal, setDispatchModal] = useState(false);
  const [responderName, setResponderName] = useState("");

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await api.getEmergencies();
      setEmergencies(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load emergencies. Check backend API connection.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    const timer = setInterval(() => {
      loadData(false);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Immediate real-time update on emergency alerts without refreshing
  useRealtimeSocket({
    emergency_alert: () => {
      loadData(false);
      toast("Emergency Alert Updated!", "warning");
    },
  });

  const handleRespondClick = (req: any) => {
    setSelectedEmergency(req);
    setResponderName("");
    setDispatchModal(true);
  };

  const handleConfirmDispatch = async () => {
    if (!selectedEmergency) return;
    const targetId = selectedEmergency.id;
    // Optimistically mark as dispatched immediately
    setEmergencies((prev) =>
      prev.map((e) =>
        e.id === targetId
          ? { ...e, status: "dispatched", responder: responderName || "Addis Emergency Unit" }
          : e
      )
    );
    try {
      await api.dispatchEmergency(targetId, responderName || "Addis Emergency Unit");
      toast(`Emergency responder dispatched for ${selectedEmergency.patient}`, "success");
    } catch {
      toast("Failed to dispatch responder", "error");
      loadData(false);
    } finally {
      setDispatchModal(false);
      setSelectedEmergency(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Connection Failure">
          {error}
        </Alert>
        <Button onClick={() => loadData(true)}>Retry Connection</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Alert variant="error" title="Important Safety Notice">
        <span className="flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Merihcare does not replace emergency medical services. All life-threatening situations must be directed to call 907 (Ambulance) or 911 immediately.
        </span>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="p-4 border-[#dc2626]/30">
          <p className="text-xs font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide mb-1">Active Emergency Requests</p>
          <p className="text-3xl font-bold text-[#dc2626]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            {emergencies.filter(e => e.status === "active").length}
          </p>
          <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mt-1">Requires immediate attention</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide mb-1">Under Management</p>
          <p className="text-3xl font-bold text-[#d97706]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            {emergencies.filter(e => e.status === "assigned" || e.status === "dispatched").length}
          </p>
          <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mt-1">Provider assigned / dispatched</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide mb-1">Resolved Today</p>
          <p className="text-3xl font-bold text-[#16a34a]" style={{ fontFamily: "DM Sans, sans-serif" }}>5</p>
          <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mt-1">Successfully handled</p>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-[#e2e8ee] dark:border-slate-700 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#18232e] dark:text-white">Emergency Requests</p>
          <div className="flex items-center gap-1.5 text-xs text-[#8a9aaa] dark:text-slate-400">
            <span className="w-1.5 h-1.5 bg-[#16a34a] rounded-full animate-pulse" />
            Auto-refreshing every 10s
          </div>
        </div>
        <div className="divide-y divide-[#f0f4f7] dark:divide-slate-700">
          {emergencies.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#8a9aaa] dark:text-slate-400">No active emergency requests found.</div>
          ) : (
            emergencies.map(req => (
              <div key={req.id} className="p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                <div className={`w-3 h-3 rounded-full shrink-0 ${req.status === "active" ? "bg-[#dc2626] animate-pulse" : "bg-[#d97706]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#18232e] dark:text-white">{req.patient}</p>
                    <span className="text-xs text-[#8a9aaa] dark:text-slate-400">{req.id}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs text-[#8a9aaa] dark:text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1"><MapPin size={12} className="shrink-0" /> {req.location}</span>
                    <span className="flex items-center gap-1"><Clock size={12} className="shrink-0" /> {req.time}</span>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${req.severity === "High" || req.type === "Critical" ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#fef3c7] text-[#92400e]"}`}>
                  {req.severity || req.type}
                </span>
                <Button
                  size="sm"
                  variant={req.status === "active" ? "danger" : "outline"}
                  disabled={req.status !== "active"}
                  onClick={() => handleRespondClick(req)}
                >
                  {req.status === "active" ? (
                    <span className="flex items-center gap-1"><Siren size={13} /> Respond</span>
                  ) : (
                    <span className="flex items-center gap-1"><CheckCircle2 size={13} /> Dispatched</span>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        open={dispatchModal}
        onClose={() => setDispatchModal(false)}
        title="Dispatch Emergency Responder"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDispatchModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmDispatch}>Dispatch Now</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[#4a5a6a] dark:text-slate-350">
            Are you sure you want to dispatch a medical responder team for {selectedEmergency?.patient}?
          </p>
          <div>
            <label className="text-xs font-bold text-[#4a5a6a] uppercase tracking-wider block mb-1">Assigned responder team / unit name</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9aaa] w-4 h-4" />
              <input
                type="text"
                placeholder="e.g. Red Cross Team A"
                value={responderName}
                onChange={(e) => setResponderName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#e2e8ee] dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-[#18232e] dark:text-slate-100 placeholder:text-[#8a9aaa] focus:outline-none focus:border-[#0d7c6a]"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
