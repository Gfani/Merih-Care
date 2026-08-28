import React from "react";

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────
export interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
}

export function SearchBar({ placeholder = "Search...", value, onChange, className = "", id }: SearchBarProps) {
  const generatedId = React.useId();
  const searchId = id || generatedId;
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a9aaa]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input
        type="text"
        id={searchId}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-[#e2e8ee] dark:border-slate-700 rounded-[10px] text-sm text-[#18232e] dark:text-slate-100 placeholder:text-[#8a9aaa] hover:border-[#cdd6df] dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0d7c6a] dark:focus:ring-cyan-400 transition-colors"
      />
    </div>
  );
}

// ─── TABS ──────────────────────────────────────────────────────────────────────
export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-0 border-b border-[#e2e8ee] dark:border-slate-700">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors relative whitespace-nowrap ${activeTab === tab.id ? "text-[#0d7c6a] dark:text-cyan-400" : "text-[#8a9aaa] hover:text-[#4a5a6a] dark:hover:text-slate-200"}`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.id ? "bg-[#e6f5f2] text-[#0d7c6a]" : "bg-[#f0f4f7] dark:bg-slate-700 text-[#8a9aaa] dark:text-slate-350"}`}>{tab.count}</span>
          )}
          {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d7c6a] dark:bg-cyan-400 rounded-full" />}
        </button>
      ))}
    </div>
  );
}

// ─── STEP PROGRESS ────────────────────────────────────────────────────────────
export function StepProgress({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${i < currentStep ? "bg-[#0d7c6a] border-[#0d7c6a] text-white" : i === currentStep ? "border-[#0d7c6a] text-[#0d7c6a] bg-[#e6f5f2]" : "border-[#e2e8ee] text-[#8a9aaa] bg-white dark:bg-slate-800"}`}>
              {i < currentStep ? (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : i + 1}
            </div>
            <span className={`text-[10px] font-medium ${i === currentStep ? "text-[#0d7c6a]" : "text-[#8a9aaa]"}`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${i < currentStep ? "bg-[#0d7c6a]" : "bg-[#e2e8ee]"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
