import React from "react";
import { Card, StatCard } from "../components/ui";
import {
  weeklyRequestsData,
  revenueData,
  serviceDistribution,
  auditLogs,
} from "../data/mock";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { AdminMapView } from "./LiveMap";

export default function DashboardSection() {
  const PIE_COLORS = ["#0d7c6a", "#1b6fba", "#d97706", "#dc2626", "#7c3aed"];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value="1,284" sub="+14 this week" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} trend={{ value: 8, up: true }} />
        <StatCard label="Total Providers" value="128" sub="118 verified" color="#1b6fba" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="2"/></svg>} trend={{ value: 3, up: true }} />
        <StatCard label="Active Requests" value="47" sub="12 searching" color="#d97706" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} trend={{ value: 5, up: true }} />
        <StatCard label="Revenue (Aug)" value="ETB 94,700" sub="↑ 6% vs Jul" color="#7c3aed" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} trend={{ value: 6, up: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly requests */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Weekly Requests</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyRequestsData} barSize={14} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f7" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="requests" name="Requests" fill="#0d7c6a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#86efac" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue trend */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Revenue Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1b6fba" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1b6fba" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f7" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip formatter={(v: any) => [`ETB ${Number(v).toLocaleString()}`, "Revenue"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area type="monotone" dataKey="revenue" stroke="#1b6fba" strokeWidth={2} fill="url(#revGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Service distribution */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Services by Type</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={serviceDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {serviceDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, ""]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {serviceDistribution.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i] }} />{d.name}</div>
                <span className="font-semibold">{d.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick stats */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] mb-3" style={{ fontFamily: "DM Sans, sans-serif" }}>Today's Overview</p>
          <div className="space-y-3">
            {[
              { label: "Appointments today", value: "24", color: "#0d7c6a" },
              { label: "Services completed", value: "18", color: "#16a34a" },
              { label: "Pending verifications", value: "2", color: "#d97706" },
              { label: "Open complaints", value: "4", color: "#dc2626" },
              { label: "Active providers", value: "89", color: "#1b6fba" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-[#4a5a6a]">{item.label}</span>
                <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] mb-3" style={{ fontFamily: "DM Sans, sans-serif" }}>Recent Activity</p>
          <div className="space-y-3">
            {auditLogs.slice(0, 5).map(log => (
              <div key={log.id} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${log.status === "success" ? "bg-[#16a34a]" : log.status === "warning" ? "bg-[#d97706]" : "bg-[#dc2626]"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#18232e] truncate">{log.action}</p>
                  <p className="text-[10px] text-[#8a9aaa]">{log.actor} · {log.timestamp.split("T")[1]?.slice(0, 5)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Live map widget */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-semibold text-[#18232e]" style={{ fontFamily: "DM Sans, sans-serif" }}>Live Provider & Patient Tracking</p>
            <p className="text-xs text-[#8a9aaa] mt-0.5">Real-time positions across Addis Ababa</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#4a5a6a] flex-shrink-0">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#0d7c6a] rounded-full inline-block" />Providers</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#1b6fba] rounded-full inline-block" />Patients</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#d97706] rounded-full animate-pulse inline-block" />Active</span>
          </div>
        </div>
        <AdminMapView compact />
      </Card>
    </div>
  );
}
