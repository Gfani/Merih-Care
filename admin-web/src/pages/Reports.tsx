import React, { useState, useEffect } from "react";
import { Select, Button, Card, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function ReportsSection() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
      } catch {
        console.error("Failed to load reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const growthData = [
    { month: "Mar", patients: 980, providers: 105 },
    { month: "Apr", patients: 1045, providers: 112 },
    { month: "May", patients: 1120, providers: 118 },
    { month: "Jun", patients: 1189, providers: 122 },
    { month: "Jul", patients: 1240, providers: 126 },
    { month: "Aug", patients: 1284, providers: 128 },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Select label="" options={[{ value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" }, { value: "6m", label: "Last 6 months" }]} className="w-40" />
        <Button variant="outline" size="sm" onClick={() => window.print()}>Export PDF</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] dark:text-white mb-4">User Growth</p>
          {loading ? (
            <SkeletonCard />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f7" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="patients" name="Patients" stroke="#0d7c6a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="providers" name="Providers" stroke="#1b6fba" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold text-[#18232e] dark:text-white mb-4">Revenue by Month</p>
          {loading ? (
            <SkeletonCard />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats?.revenueData || []} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f7" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8a9aaa" }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
                <Tooltip formatter={(v: any) => [`ETB ${Number(v).toLocaleString()}`, "Revenue"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#1b6fba" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Cancellation Rate", value: "8.2%", trend: "-1.4%", up: false },
          { label: "Avg Rating", value: "4.7", trend: "+0.1", up: true },
          { label: "Completion Rate", value: "91.8%", trend: "+1.4%", up: true },
          { label: "Avg Response Time", value: "14 min", trend: "-2 min", up: true },
        ].map(m => (
          <Card key={m.label} className="p-4">
            <p className="text-xs text-[#8a9aaa] mb-1">{m.label}</p>
            <p className="text-xl font-bold text-[#18232e]" style={{ fontFamily: "DM Sans, sans-serif" }}>{m.value}</p>
            <p className={`text-xs font-semibold ${m.up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>{m.trend}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
