import React, { useState, useEffect } from "react";
import { Card, Input, Button, Avatar, ConfirmDialog, Modal, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { useBlocker } from "react-router-dom";

export default function SettingsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [commissionRate, setCommissionRate] = useState("15");
  const [minPayout, setMinPayout] = useState("500");

  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  // Router blocker for unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Maintenance confirm state
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);
  const [maintenanceConfirmText, setMaintenanceConfirmText] = useState("");

  // Edit profile state
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin Kebede");
  const [adminEmail, setAdminEmail] = useState("admin@merihcare.et");

  // Change password state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setEmailNotifs(data.emailNotifs);
      setSmsNotifs(data.smsNotifs);
      setMaintenanceMode(data.maintenanceMode);
      setCommissionRate(data.commissionRate.toString());
      setMinPayout(data.minPayout.toString());

      const profile = await api.getAdminProfile();
      setAdminName(profile.name);
      setAdminEmail(profile.email);
    } catch {
      toast("Failed to load settings from server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleSave = async () => {
    try {
      await api.updateSettings({
        emailNotifs,
        smsNotifs,
        maintenanceMode,
        commissionRate,
        minPayout
      });
      setIsDirty(false);
      toast("Platform settings saved successfully!", "success");
    } catch {
      toast("Failed to save settings", "error");
    }
  };

  const handleMaintenanceToggle = async (checked: boolean) => {
    if (checked) {
      setMaintenanceConfirmText("");
      setMaintenanceConfirmOpen(true);
    } else {
      try {
        await api.updateSettings({
          emailNotifs,
          smsNotifs,
          maintenanceMode: false,
          commissionRate,
          minPayout
        });
        setMaintenanceMode(false);
        setIsDirty(false);
        toast("Maintenance mode disabled", "info");
      } catch {
        toast("Failed to disable maintenance mode", "error");
      }
    }
  };

  const confirmMaintenanceMode = async () => {
    if (maintenanceConfirmText === "MAINTENANCE") {
      try {
        await api.updateSettings({
          emailNotifs,
          smsNotifs,
          maintenanceMode: true,
          commissionRate,
          minPayout
        });
        setMaintenanceMode(true);
        setIsDirty(false);
        toast("Maintenance mode enabled. Patient app access disabled.", "warning");
        setMaintenanceConfirmOpen(false);
      } catch {
        toast("Failed to enable maintenance mode", "error");
      }
    } else {
      toast("Confirmation text does not match", "error");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateAdminProfile(adminName, adminEmail);
      toast("Profile updated successfully", "success");
      setEditProfileOpen(false);
    } catch (err: any) {
      toast(err.message || "Failed to update profile", "error");
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "error");
      return;
    }
    try {
      await api.updateAdminPassword(currentPassword, newPassword);
      toast("Password updated successfully", "success");
      setChangePasswordOpen(false);
    } catch (err: any) {
      toast(err.message || "Failed to update password", "error");
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl space-y-5">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 animate-fade-in">
      <Card className="p-5">
        <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Platform Settings</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#18232e] dark:text-white">Email Notifications</p>
              <p className="text-xs text-[#8a9aaa] dark:text-slate-400">Send email alerts for critical events</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={emailNotifs} onChange={e => { setEmailNotifs(e.target.checked); setIsDirty(true); }} className="sr-only" />
              <div className={`w-11 h-6 rounded-full transition-colors ${emailNotifs ? "bg-[#0d7c6a]" : "bg-[#cdd6df]"} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transition-transform ${emailNotifs ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#18232e] dark:text-white">SMS Notifications</p>
              <p className="text-xs text-[#8a9aaa] dark:text-slate-400">Send SMS for appointment updates</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={smsNotifs} onChange={e => { setSmsNotifs(e.target.checked); setIsDirty(true); }} className="sr-only" />
              <div className={`w-11 h-6 rounded-full transition-colors ${smsNotifs ? "bg-[#0d7c6a]" : "bg-[#cdd6df]"} relative`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transition-transform ${smsNotifs ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-[#18232e] dark:text-white">Maintenance Mode</p>
              <p className="text-xs text-[#dc2626] font-semibold">⚠ Disables patient access to the platform</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={maintenanceMode} onChange={e => handleMaintenanceToggle(e.target.checked)} className="sr-only" />
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
          <Input label="Platform commission rate (%)" value={commissionRate} onChange={e => { setCommissionRate(e.target.value); setIsDirty(true); }} type="number" />
          <Input label="Minimum payout amount (ETB)" value={minPayout} onChange={e => { setMinPayout(e.target.value); setIsDirty(true); }} type="number" />
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button size="sm" onClick={handleSave}>Save Changes</Button>
          {isDirty && <span className="text-xs text-[#dc2626] font-semibold animate-pulse">⚠ You have unsaved changes!</span>}
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-[#18232e] mb-4" style={{ fontFamily: "DM Sans, sans-serif" }}>Admin Account</p>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={adminName} size="lg" />
          <div>
            <p className="font-semibold text-[#18232e] dark:text-white">{adminName}</p>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400">Super Administrator</p>
            <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{adminEmail}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setChangePasswordOpen(true);
          }}>Change Password</Button>
          <Button variant="ghost" size="sm" onClick={() => {
            setAdminName(adminName);
            setAdminEmail(adminEmail);
            setEditProfileOpen(true);
          }}>Edit Profile</Button>
        </div>
      </Card>

      {/* Typed maintenance mode confirmation modal */}
      <Modal
        open={maintenanceConfirmOpen}
        onClose={() => setMaintenanceConfirmOpen(false)}
        title="Activate Maintenance Mode?"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setMaintenanceConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmMaintenanceMode}>Enable Maintenance</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[#4a5a6a] dark:text-slate-350">
            WARNING: Enabling maintenance mode will immediately block patients and providers from booking new visits. To confirm, type <strong className="text-red-500">MAINTENANCE</strong> in the field below:
          </p>
          <input
            type="text"
            value={maintenanceConfirmText}
            onChange={(e) => setMaintenanceConfirmText(e.target.value)}
            placeholder="Type MAINTENANCE to confirm"
            className="w-full border border-[#dc2626]/30 rounded-lg p-2 text-sm bg-white dark:bg-slate-800 text-[#18232e] dark:text-slate-100 placeholder:text-[#8a9aaa] focus:outline-none focus:border-[#dc2626]"
          />
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Edit Profile">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input label="Admin Name" value={adminName} onChange={e => setAdminName(e.target.value)} required />
          <Input label="Admin Email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} type="email" required />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
            <Button type="button" variant="ghost" onClick={() => setEditProfileOpen(false)}>Cancel</Button>
            <Button type="submit">Save Details</Button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} title="Change Password">
        <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
          <Input label="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} type="password" required />
          <Input label="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" required />
          <Input label="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" required />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
            <Button type="button" variant="ghost" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button type="submit">Update Password</Button>
          </div>
        </form>
      </Modal>

      {/* React Router blocker dialog */}
      {blocker.state === "blocked" ? (
        <ConfirmDialog
          open={true}
          onClose={() => blocker.reset()}
          onConfirm={() => blocker.proceed()}
          title="Unsaved Changes"
          message="You have unsaved platform settings. Are you sure you want to leave? Any unsaved changes will be lost."
          confirmLabel="Discard & Leave"
          confirmVariant="danger"
        />
      ) : null}
    </div>
  );
}
