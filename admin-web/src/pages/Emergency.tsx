import React, { useState } from "react";
import { Alert, Card, Button, toast } from "../components/ui";

export default function EmergencySection() {
  const [emergencies, setEmergencies] = useState([
    { id: "EM-001", patient: "Frehiwot Solomon", location: "Piazza, Addis Ababa", time: "10:22 AM", status: "active", severity: "High" },
    { id: "EM-002", patient: "Dawit Haile", location: "Kazanchis, Addis Ababa", time: "09:55 AM", status: "assigned", severity: "Medium" },
  ]);

  const handleRespond = (id: string, name: string) => {
    setEmergencies(prev => prev.map(e => e.id === id ? { ...e, status: "assigned" } : e));
    toast(`Emergency response dispatched for ${name} (${id})`, "success");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <Alert variant="error" title="⚠ Important Safety Notice">
        Merihcare does not replace emergency medical services. All life-threatening situations must be directed to call 907 (Ambulance) or 911 immediately.
      </Alert>
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card className="p-4 border-[#dc2626]/30">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wide mb-1">Active Emergency Requests</p>
          <p className="text-3xl font-bold text-[#dc2626]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            {emergencies.filter(e => e.status === "active").length}
          </p>
          <p className="text-xs text-[#8a9aaa] mt-1">Requires immediate attention</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wide mb-1">Under Management</p>
          <p className="text-3xl font-bold text-[#d97706]" style={{ fontFamily: "DM Sans, sans-serif" }}>
            {emergencies.filter(e => e.status === "assigned").length}
          </p>
          <p className="text-xs text-[#8a9aaa] mt-1">Provider assigned</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-[#8a9aaa] uppercase tracking-wide mb-1">Resolved Today</p>
          <p className="text-3xl font-bold text-[#16a34a]" style={{ fontFamily: "DM Sans, sans-serif" }}>5</p>
          <p className="text-xs text-[#8a9aaa] mt-1">Successfully handled</p>
        </Card>
      </div>
      <Card>
        <div className="p-4 border-b border-[#e2e8ee] flex items-center justify-between">
          <p className="text-sm font-semibold text-[#18232e]">Emergency Requests</p>
          <span className="text-xs text-[#8a9aaa]">Auto-refreshing</span>
        </div>
        <div className="divide-y divide-[#f0f4f7]">
          {emergencies.map(req => (
            <div key={req.id} className="p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
              <div className={`w-3 h-3 rounded-full shrink-0 ${req.status === "active" ? "bg-[#dc2626] animate-pulse" : "bg-[#d97706]"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#18232e]">{req.patient}</p>
                  <span className="text-xs text-[#8a9aaa]">{req.id}</span>
                </div>
                <p className="text-xs text-[#8a9aaa] truncate">📍 {req.location} · {req.time}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${req.severity === "High" ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#fef3c7] text-[#92400e]"}`}>{req.severity}</span>
              <Button
                size="sm"
                variant={req.status === "active" ? "danger" : "outline"}
                disabled={req.status !== "active"}
                onClick={() => handleRespond(req.id, req.patient)}
              >
                {req.status === "active" ? "Respond" : "Dispatched"}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
