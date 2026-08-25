import React, { useState } from "react";
import { Card, Input, Button, Avatar, toast } from "../components/ui";

export default function SettingsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [commissionRate, setCommissionRate] = useState("15");
  const [minPayout, setMinPayout] = useState("500");

  const handleSave = () => {
    toast("Platform settings saved successfully!", "success");
  };

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <Card className="p-5">
        <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Platform Settings</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#18232e]">Email Notifications</p>
              <p className="text-xs text-[#8a9aaa]">Send email alerts for critical events</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={emailNotifs} onChange={e => setEmailNotifs(e.target.checked)} className="sr-only" />
              <div className={`w-11 h-6 rounded-full transition-colors ${emailNotifs ? "bg-[#0d7c6a]" : "bg-[#cdd6df]"} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transition-transform ${emailNotifs ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#18232e]">SMS Notifications</p>
              <p className="text-xs text-[#8a9aaa]">Send SMS for appointment updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={smsNotifs} onChange={e => setSmsNotifs(e.target.checked)} className="sr-only" />
              <div className={`w-11 h-6 rounded-full transition-colors ${smsNotifs ? "bg-[#0d7c6a]" : "bg-[#cdd6df]"} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transition-transform ${smsNotifs ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#f0f4f7]">
            <div>
              <p className="text-sm font-medium text-[#18232e]">Maintenance Mode</p>
              <p className="text-xs text-[#dc2626]">⚠ Disables patient access to the platform</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={maintenanceMode} onChange={e => setMaintenanceMode(e.target.checked)} className="sr-only" />
              <div className={`w-11 h-6 rounded-full transition-colors ${maintenanceMode ? "bg-[#dc2626]" : "bg-[#cdd6df]"} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transition-transform ${maintenanceMode ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Payment Settings</p>
        <div className="space-y-3">
          <Input label="Platform commission rate (%)" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} type="number" />
          <Input label="Minimum payout amount (ETB)" value={minPayout} onChange={e => setMinPayout(e.target.value)} type="number" />
        </div>
        <Button className="mt-4" size="sm" onClick={handleSave}>Save Changes</Button>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Admin Account</p>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name="Admin Kebede" size="lg" />
          <div>
            <p className="font-semibold text-[#18232e]">Admin Kebede</p>
            <p className="text-xs text-[#8a9aaa]">Super Administrator</p>
            <p className="text-xs text-[#8a9aaa]">admin@merihcare.et</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast("Password reset email sent!", "info")}>Change Password</Button>
          <Button variant="ghost" size="sm" onClick={() => toast("Profile editor opened", "info")}>Edit Profile</Button>
        </div>
      </Card>
    </div>
  );
}
