import React, { useState } from "react";
import { SearchBar, Button, Card, DataTable, StatusBadge, ConfirmDialog, Modal, Input, Textarea, toast } from "../components/ui";
import { serviceCategories as mockCategories } from "../data/mock";

export default function ServicesSection() {
  const [search, setSearch] = useState("");
  const [services, setServices] = useState(() =>
    mockCategories.map(s => ({ ...s, status: "active" as "active" | "closed" }))
  );

  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  const [formModal, setFormModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceFrom, setPriceFrom] = useState("");

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggleClick = (row: any) => {
    setSelectedService(row);
    setConfirmModal(true);
  };

  const confirmToggleActive = () => {
    if (!selectedService) return;
    const nextStatus = selectedService.status === "active" ? "closed" : "active";
    setServices(prev => prev.map(s => s.id === selectedService.id ? { ...s, status: nextStatus } : s));
    toast(`Service category ${selectedService.status === "active" ? "deactivated" : "activated"}`, "info");
    setConfirmModal(false);
    setSelectedService(null);
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
    setDescription(row.description);
    setPriceFrom(row.priceFrom.toString());
    setFormModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
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

    if (editingService) {
      setServices(prev => prev.map(s => s.id === editingService.id ? { ...s, name, description, priceFrom: numPrice } : s));
      toast("Service category updated", "success");
    } else {
      const newId = `sc-${Date.now()}`;
      setServices(prev => [
        ...prev,
        { id: newId, name, description, priceFrom: numPrice, providerCount: 0, status: "active", icon: "🩺", color: "#0d7c6a" }
      ]);
      toast("Service category added", "success");
    }
    setFormModal(false);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <SearchBar placeholder="Search services..." value={search} onChange={setSearch} className="flex-1 min-w-[200px]" />
        <Button size="sm" onClick={handleAddClick}>+ Add Service</Button>
      </div>
      <Card>
        <DataTable
          columns={[
            { key: "service", header: "Service", render: (row) => (
              <div className="flex items-center gap-2">
                <span className="text-lg">{row.icon as string}</span>
                <div>
                  <p className="font-medium text-sm">{row.name as string}</p>
                  <p className="text-xs text-[#8a9aaa] dark:text-slate-400">{row.description as string}</p>
                </div>
              </div>
            )},
            { key: "priceFrom", header: "Price from", render: (row) => <span className="font-semibold text-[#0d7c6a] dark:text-cyan-400">ETB {(row.priceFrom as number).toLocaleString()}</span> },
            { key: "providerCount", header: "Providers", render: (row) => <span className="font-semibold">{row.providerCount as number}</span> },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status as any} /> },
            { key: "actions", header: "Actions", render: (row) => (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2" onClick={() => handleEditClick(row)}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-xs !py-1 !px-2 text-[#dc2626] hover:!bg-[#fee2e2]" onClick={() => handleToggleClick(row)}>
                  {(row.status as "active" | "closed") === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            )},
          ]}
          data={filtered as any}
        />
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
