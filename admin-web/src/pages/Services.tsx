import React, { useState, useEffect } from "react";
import { SearchBar, Button, Card, DataTable, StatusBadge, ConfirmDialog, Modal, Input, Textarea, toast, SkeletonCard } from "../components/ui";
import { api } from "../services/api";
import { AlertTriangle } from "lucide-react";

export default function ServicesSection() {
  const [search, setSearch] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal / Form state
  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [formModal, setFormModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceFrom, setPriceFrom] = useState("");

  // Permissions configuration
  const getAdminUser = () => {
    const raw = localStorage.getItem("admin_user");
    if (!raw || raw === "undefined" || raw === "null") return {};
    try { return JSON.parse(raw); } catch { return {}; }
  };
  const adminUser = getAdminUser();
  const userRole = adminUser.role || "";
  const userPermissions = adminUser.permissions || [];
  const canModifyServices = userRole === "super_admin" || userPermissions.includes("edit:services") || userPermissions.includes("admin:services");

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getServices();
      setServices(data);
      setLastUpdated(new Date());
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to load services.");
      if (err.response?.status === 401) {
        api.logout();
        toast("Session expired. Please log in again.", "error");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleToggleClick = (row: any) => {
    setSelectedService(row);
    setConfirmModal(true);
  };

  const confirmToggleActive = async () => {
    if (!selectedService) return;
    try {
      await api.toggleService(selectedService.id);
      toast(`Service category status updated successfully.`, "success");
      loadServices();
    } catch (err: any) {
      toast(err.message || "Failed to toggle service status.", "error");
    } finally {
      setConfirmModal(false);
      setSelectedService(null);
    }
  };

  const handleAddClick = () => {
    setEditingService(null);
    setName("");
    setDescription("");
    setPriceFrom("");
    setFormModal(true);
  };

  const handleEditClick = (row: any) => {
    setEditingService(row);
    setName(row.name);
    setDescription(row.description || "");
    setPriceFrom(row.priceFrom.toString());
    setFormModal(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !priceFrom) {
      toast("Name and price are required", "error");
      return;
    }
    const numPrice = parseFloat(priceFrom);
    if (isNaN(numPrice)) {
      toast("Price must be a valid number", "error");
      return;
    }

    try {
      setLoading(true);
      if (editingService) {
        await api.updateService(editingService.id, { name, description, priceFrom: numPrice });
        toast("Service category updated successfully", "success");
      } else {
        await api.createService({ name, description, priceFrom: numPrice });
        toast("Service category created successfully", "success");
      }
      setFormModal(false);
      loadServices();
    } catch (err: any) {
      toast(err.message || "Error saving service category.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkToggle = async () => {
    if (!canModifyServices) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await api.toggleService(id);
      }
      toast("Bulk service categories toggled.", "success");
      loadServices();
    } catch (err: any) {
      toast(err.message || "Bulk deactivation failure.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filter/Sort Logic
  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar placeholder="Search services..." value={search} onChange={(val) => { setSearch(val); setCurrentPage(1); }} className="flex-1 min-w-[200px]" />
        
        <Button size="sm" onClick={handleAddClick} disabled={!canModifyServices} title={!canModifyServices ? "Insufficient permissions" : ""} className="cursor-pointer">
          + Add Service
        </Button>
      </div>

      {isStale && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 text-xs rounded-[8px] flex justify-between items-center">
          <span className="flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" aria-hidden="true" />
            <span>Stale Data Warning: Service metrics were fetched more than 5 minutes ago.</span>
          </span>
          <Button size="sm" variant="ghost" onClick={loadServices} className="!py-0.5 !px-2 text-amber-900 font-bold hover:bg-amber-100">Refresh</Button>
        </div>
      )}

      {/* Sync Timestamp and Bulk Actions */}
      <div className="text-[10px] text-[#8a9aaa] flex justify-between items-center px-1">
        <span>Last Sync: {lastUpdated.toLocaleTimeString()}</span>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#18232e] dark:text-slate-300">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" disabled={!canModifyServices} onClick={handleBulkToggle} className="!py-0.5 !px-2 text-[10px]">
              Bulk Toggle Active
            </Button>
          </div>
        )}
      </div>

      <Card>
        {loading ? (
          <div className="p-6 space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-500 font-semibold flex items-center justify-center gap-1.5">
              <AlertTriangle size={16} className="text-red-500 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
            <Button size="sm" onClick={loadServices} className="cursor-pointer">Retry Loading</Button>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#8a9aaa]">
            No services registered in category database.
          </div>
        ) : (
          <div>
            <DataTable
              columns={[
                { 
                  key: "select", 
                  header: <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={() => setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id as string)))} />,
                  render: (row) => <input type="checkbox" checked={selectedIds.has(row.id as string)} onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(row.id as string)) next.delete(row.id as string);
                    else next.add(row.id as string);
                    setSelectedIds(next);
                  }} />
                },
                { key: "service", header: "Service", render: (row) => (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{(row.icon as string) || "🩺"}</span>
                    <div>
                      <p className="font-medium text-sm text-[#18232e] dark:text-white">{row.name as string}</p>
                      <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{row.description as string}</p>
                    </div>
                  </div>
                )},
                { key: "priceFrom", header: "Price from", render: (row) => <span className="font-semibold text-[#0d7c6a] dark:text-cyan-400">ETB {(row.priceFrom as number).toLocaleString()}</span> },
                { key: "providerCount", header: "Providers", render: (row) => <span className="font-semibold">{row.providerCount as number || 0}</span> },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
                { key: "actions", header: "Actions", render: (row) => (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={!canModifyServices} className="text-xs !py-1 !px-2 cursor-pointer" onClick={() => handleEditClick(row)}>Edit</Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      disabled={!canModifyServices} 
                      className="text-xs !py-1 !px-2 text-[#dc2626] hover:!bg-[#fee2e2] disabled:opacity-50 cursor-pointer" 
                      onClick={() => handleToggleClick(row)}
                    >
                      {(row.status as "active" | "closed") === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                )},
              ]}
              data={paginated as any}
            />

            {/* Pagination controls */}
            <div className="flex items-center justify-between border-t border-[#f0f4f7] dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-800 text-xs">
              <span className="text-[#8a9aaa]">Page {currentPage} of {totalPages} ({filtered.length} total categories)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="cursor-pointer">Prev</Button>
                <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="cursor-pointer">Next</Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmModal}
        onClose={() => setConfirmModal(false)}
        onConfirm={confirmToggleActive}
        title={selectedService?.status === "active" ? "Deactivate Service" : "Activate Service"}
        message={`Are you sure you want to ${selectedService?.status === "active" ? "deactivate" : "activate"} the service category "${selectedService?.name}"?`}
        confirmLabel={selectedService?.status === "active" ? "Deactivate" : "Activate"}
        confirmVariant={selectedService?.status === "active" ? "danger" : "success"}
      />

      <Modal open={formModal} onClose={() => setFormModal(false)} title={editingService ? "Edit Service Category" : "Add Service Category"}>
        <form onSubmit={handleSaveForm} className="space-y-4">
          <Input label="Service Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pediatrician visit" required />
          <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief overview of the service category..." />
          <Input label="Starting Price (ETB)" value={priceFrom} onChange={e => setPriceFrom(e.target.value)} type="number" placeholder="e.g. 500" required />
          
          <div className="flex justify-end gap-2 pt-2 border-t border-[#f0f4f7] dark:border-slate-700">
            <Button type="button" variant="ghost" onClick={() => setFormModal(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
