import React from "react";
import { Avatar } from "./avatar";
import { Rating } from "./rating";
import { Card } from "./card";
import { StatusBadge } from "./badge";
import { Provider, Appointment } from "../../data/mock";

// ─── DATA TABLE ────────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

export function DataTable<T = any>({ columns, data, onRowClick }: { columns: Column<T>[]; data: T[]; onRowClick?: (row: T) => void }) {
  const primaryCol = columns[0];
  const otherCols = columns.slice(1).filter(c => c.key !== "actions");
  const actionsCol = columns.find(c => c.key === "actions");

  const handleKeyDown = (e: React.KeyboardEvent, row: T) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className="w-full">
      {/* ── Desktop Table Layout ── */}
      <div className="hidden sm:block overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8ee] dark:border-slate-700">
              {columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide whitespace-nowrap" style={{ width: col.width }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-12 text-[#8a9aaa] text-sm">No data available</td></tr>
            ) : (
              data.map((row, i) => (
                <tr 
                  key={i} 
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  onKeyDown={onRowClick ? (e) => handleKeyDown(e, row) : undefined}
                  onClick={() => onRowClick?.(row)} 
                  className={`border-b border-[#f0f4f7] dark:border-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d7c6a] dark:focus-visible:ring-cyan-400 ${onRowClick ? "hover:bg-[#f8fafc] dark:hover:bg-slate-800/30 cursor-pointer" : ""}`}
                >
                  {columns.map(col => {
                    const isActions = col.key === "actions";
                    return (
                      <td key={col.key} className="px-4 py-3.5 text-[#18232e] dark:text-slate-150 whitespace-nowrap" onClick={isActions ? (e) => e.stopPropagation() : undefined}>
                        {col.render ? col.render(row) : ((row as any)[col.key] as React.ReactNode)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Stacked Cards Layout ── */}
      <div className="block sm:hidden space-y-3">
        {data.length === 0 ? (
          <div className="text-center py-12 text-[#8a9aaa] text-sm bg-white dark:bg-slate-800 rounded-lg border border-[#e2e8ee] dark:border-slate-700">No data available</div>
        ) : (
          data.map((row, i) => (
            <div
              key={i}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              onKeyDown={onRowClick ? (e) => handleKeyDown(e, row) : undefined}
              onClick={() => onRowClick?.(row)}
              className={`bg-white dark:bg-slate-800 rounded-[12px] border border-[#e2e8ee] dark:border-slate-700 p-4 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d7c6a] dark:focus-visible:ring-cyan-400 ${onRowClick ? "active:bg-[#f8fafc] dark:active:bg-slate-800/50 cursor-pointer" : ""}`}
            >
              {/* Primary Identity Header */}
              {primaryCol && (
                <div className="flex items-center justify-between gap-2 border-b border-[#f0f4f7] dark:border-slate-700 pb-2.5">
                  <div className="min-w-0 flex-1">
                    {primaryCol.render ? primaryCol.render(row) : <span className="font-semibold text-sm text-[#18232e] dark:text-white">{(row as any)[primaryCol.key] as React.ReactNode}</span>}
                  </div>
                </div>
              )}

              {/* Other Fields Stacked */}
              {otherCols.length > 0 && (
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
                  {otherCols.map(col => (
                    <div key={col.key} className="space-y-0.5">
                      <p className="text-[10px] font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wider">{col.header}</p>
                      <div className="text-[#18232e] dark:text-slate-200">
                        {col.render ? col.render(row) : ((row as any)[col.key] as React.ReactNode)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions Footer */}
              {actionsCol && (
                <div className="flex justify-end gap-1.5 pt-2 border-t border-[#f0f4f7] dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                  {actionsCol.render ? actionsCol.render(row) : ((row as any)[actionsCol.key] as React.ReactNode)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold text-[#18232e] dark:text-white" style={{ fontFamily: "DM Sans, sans-serif" }}>{title}</h2>
      {action}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, icon, color = "#0d7c6a", trend }: { label: string; value: string | number; sub?: string; icon?: React.ReactNode; color?: string; trend?: { value: number; up: boolean } }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#8a9aaa] dark:text-slate-400 uppercase tracking-wide mb-1 truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-[#18232e] dark:text-white leading-tight" style={{ fontFamily: "DM Sans, sans-serif" }}>{value}</p>
          {sub && <p className="text-xs text-[#8a9aaa] dark:text-slate-400 mt-1">{sub}</p>}
          {trend && (
            <p className={`text-xs font-semibold mt-1 ${trend.up ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
              {trend.up ? "↑" : "↓"} {Math.abs(trend.value)}% vs last week
            </p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: color + "20" }}>
            <span style={{ color }}>{icon}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── PROVIDER CARD ────────────────────────────────────────────────────────────
export function ProviderCard({ provider, onClick, compact }: { provider: Provider; onClick?: () => void; compact?: boolean }) {
  return (
    <Card hover onClick={onClick} className={compact ? "p-3" : "p-4"}>
      <div className="flex items-start gap-3">
        <Avatar src={provider.avatar} name={provider.name} size={compact ? "md" : "lg"} verified={provider.verified} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#18232e] dark:text-white truncate">{provider.name}</p>
              <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{provider.title}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${provider.available ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f3f4f6] dark:bg-slate-700 text-[#6b7280] dark:text-slate-350"}`}>
              {provider.available ? "Available" : "Busy"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <Rating value={provider.rating} count={provider.reviewCount} />
            <span className="text-xs text-[#8a9aaa] dark:text-slate-400">· {provider.experience}y exp</span>
            {provider.distance && <span className="text-xs text-[#8a9aaa] dark:text-slate-400">· {provider.distance}</span>}
          </div>
          {!compact && (
            <div className="flex flex-wrap gap-1 mt-2">
              {provider.services.slice(0, 2).map(s => (
                <span key={s} className="text-xs bg-[#f0f4f7] dark:bg-slate-700 text-[#4a5a6a] dark:text-slate-300 px-2 py-0.5 rounded-full">{s}</span>
              ))}
              {provider.services.length > 2 && <span className="text-xs bg-[#f0f4f7] dark:bg-slate-700 text-[#8a9aaa] dark:text-slate-400 px-2 py-0.5 rounded-full">+{provider.services.length - 2}</span>}
            </div>
          )}
          {!compact && (
            <p className="text-sm font-semibold text-[#0d7c6a] dark:text-cyan-400 mt-2">From ETB {provider.pricePerVisit.toLocaleString()}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── APPOINTMENT CARD ─────────────────────────────────────────────────────────
export function AppointmentCard({ apt, onClick }: { apt: Appointment; onClick?: () => void }) {
  return (
    <Card hover onClick={onClick} className="p-4">
      <div className="flex items-start gap-3">
        <Avatar src={apt.providerAvatar} name={apt.providerName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#18232e] dark:text-white">{apt.service}</p>
              <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{apt.providerName}</p>
            </div>
            <StatusBadge status={apt.status as any} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-[#4a5a6a] dark:text-slate-350">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {apt.date}
            </span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {apt.time}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#8a9aaa] dark:text-slate-400 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {apt.location}
            </span>
            <span className="text-sm font-semibold text-[#18232e] dark:text-white">ETB {apt.amount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
