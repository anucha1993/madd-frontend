"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  createAddonCategory,
  createAddonItem,
  deleteAddonCategory,
  deleteAddonItem,
  listAddonCategories,
  listAddonItems,
  updateAddonItem,
  type AddonCategory,
  type AddonItem,
  type AddonItemInput,
} from "@/lib/addonItems";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

const CARRIER_OPTIONS: ("UPS" | "DHL")[] = ["UPS", "DHL"];

type ItemForm = {
  name: string;
  carriers: ("UPS" | "DHL")[];
  price_type: "FIXED" | "MANUAL";
  price: string;
  trigger_type: "MANUAL" | "AUTO";
  status: boolean;
  note: string;
};

const emptyForm: ItemForm = {
  name: "",
  carriers: ["UPS", "DHL"],
  price_type: "MANUAL",
  price: "",
  trigger_type: "MANUAL",
  status: true,
  note: "",
};

export default function AddonSettingsPage() {
  const [categories, setCategories] = useState<AddonCategory[]>([]);
  const [items, setItems] = useState<AddonItem[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AddonItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [cats, its] = await Promise.all([listAddonCategories(), listAddonItems()]);
      setCategories(cats);
      setItems(its);
      setActiveCategoryId((current) => current ?? cats[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load add-on data");
    } finally {
      setLoading(false);
    }
  }

  const visibleItems = items.filter((i) => i.addon_category_id === activeCategoryId);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    setCategoryError("");
    try {
      const created = await createAddonCategory(newCategoryName.trim());
      setCategories((prev) => [...prev, created]);
      setActiveCategoryId(created.id);
      setNewCategoryName("");
      setShowAddCategory(false);
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleDeleteCategory(category: AddonCategory) {
    if (!confirm(`Delete category "${category.name}"? (only allowed if empty)`)) return;
    try {
      await deleteAddonCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setActiveCategoryId((current) => (current === category.id ? null : current));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  function openAddItem() {
    if (!activeCategoryId) return;
    setEditingItem(null);
    setForm(emptyForm);
    setItemError("");
    setShowItemModal(true);
  }

  function openEditItem(item: AddonItem) {
    setEditingItem(item);
    setForm({
      name: item.name,
      carriers: item.carriers,
      price_type: item.price_type,
      price: item.price != null ? String(item.price) : "",
      trigger_type: item.trigger_type,
      status: item.status,
      note: item.note ?? "",
    });
    setItemError("");
    setShowItemModal(true);
  }

  function toggleCarrier(carrier: "UPS" | "DHL") {
    setForm((prev) => ({
      ...prev,
      carriers: prev.carriers.includes(carrier)
        ? prev.carriers.filter((c) => c !== carrier)
        : [...prev.carriers, carrier],
    }));
  }

  async function handleSaveItem() {
    if (!activeCategoryId || !form.name.trim() || form.carriers.length === 0) return;
    if (form.price_type === "FIXED" && !form.price) return;

    setSavingItem(true);
    setItemError("");
    try {
      const payload: AddonItemInput = {
        addon_category_id: activeCategoryId,
        name: form.name.trim(),
        carriers: form.carriers,
        price_type: form.price_type,
        price: form.price ? Number(form.price) : null,
        trigger_type: form.trigger_type,
        status: form.status,
        note: form.note.trim() || undefined,
      };

      if (editingItem) {
        const updated = await updateAddonItem(editingItem.id, payload);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await createAddonItem(payload);
        setItems((prev) => [...prev, created]);
      }
      setShowItemModal(false);
    } catch (err) {
      setItemError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleDeleteItem(item: AddonItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await deleteAddonItem(item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  return (
    <div>
      <PageHeader
        title="Add-on Settings"
        description="รายการบริการเสริม/ค่าธรรมเนียมเพิ่มเติมนอกเหนือบริการหลัก แยกตามหมวดหมู่"
      />

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูล Add-on..." />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`group flex items-center gap-1 rounded-t-lg px-3 py-2 text-sm font-medium ${
                  activeCategoryId === cat.id
                    ? "bg-brand-amber text-brand-navy-dark"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <button type="button" onClick={() => setActiveCategoryId(cat.id)}>
                  {cat.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className={`rounded-full p-0.5 ${
                    activeCategoryId === cat.id ? "hover:bg-black/10" : "hover:bg-slate-300"
                  }`}
                  aria-label={`Delete ${cat.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setNewCategoryName("");
                setCategoryError("");
                setShowAddCategory(true);
              }}
              className="flex items-center gap-1 rounded-t-lg px-3 py-2 text-sm font-medium text-brand-navy hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" /> Add Category
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
              <p className="font-medium text-slate-600">ยังไม่มีหมวดหมู่ Add-on กด &quot;Add Category&quot; เพื่อเริ่มสร้าง</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={openAddItem}
                  disabled={!activeCategoryId}
                  className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" /> Add Item
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Name</th>
                      <th className="px-5 py-2.5 font-medium">Carrier</th>
                      <th className="px-5 py-2.5 font-medium">Price Type</th>
                      <th className="px-5 py-2.5 font-medium text-right">Price</th>
                      <th className="px-5 py-2.5 font-medium">Trigger</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-6 text-center text-sm text-slate-400">
                          No add-on items in this category yet.
                        </td>
                      </tr>
                    ) : (
                      visibleItems.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-5 py-3 font-medium text-slate-700">
                            {item.name}
                            {item.note && <div className="text-xs font-normal text-slate-400">{item.note}</div>}
                          </td>
                          <td className="px-5 py-3 text-slate-500">{item.carriers.join(" / ")}</td>
                          <td className="px-5 py-3 text-slate-500">
                            {item.price_type === "FIXED" ? "Fixed" : "Manual (per shipment)"}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500">
                            {item.price != null ? Number(item.price).toLocaleString() : "-"}
                          </td>
                          <td className="px-5 py-3 text-slate-500">{item.trigger_type === "AUTO" ? "Auto" : "Manual"}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                item.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {item.status ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditItem(item)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {showAddCategory && (
            <Modal title="Add Category" onClose={() => setShowAddCategory(false)}>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Category Name</span>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Remote Area Surcharge"
                    className={inputClass}
                  />
                </label>
                {categoryError && <p className="text-sm text-red-600">{categoryError}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCategory(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={savingCategory || !newCategoryName.trim()}
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    {savingCategory ? "Saving..." : "Add"}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {showItemModal && (
            <Modal title={editingItem ? "Edit Add-on Item" : "Add Add-on Item"} onClose={() => setShowItemModal(false)}>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Name</span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className={inputClass}
                  />
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Carrier</span>
                  <div className="flex gap-4">
                    {CARRIER_OPTIONS.map((carrier) => (
                      <label key={carrier} className="flex items-center gap-1.5 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={form.carriers.includes(carrier)}
                          onChange={() => toggleCarrier(carrier)}
                        />
                        {carrier}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Price Type</span>
                    <select
                      value={form.price_type}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, price_type: e.target.value as "FIXED" | "MANUAL" }))
                      }
                      className={inputClass}
                    >
                      <option value="MANUAL">Manual (entered per shipment)</option>
                      <option value="FIXED">Fixed</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">
                      Price {form.price_type === "MANUAL" && "(default, optional)"}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Trigger</span>
                    <select
                      value={form.trigger_type}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, trigger_type: e.target.value as "MANUAL" | "AUTO" }))
                      }
                      className={inputClass}
                    >
                      <option value="MANUAL">Manual (เลือกตอนสร้าง Shipment)</option>
                      <option value="AUTO">Auto (เงื่อนไขจะผูกภายหลัง)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-600">Status</span>
                    <select
                      value={form.status ? "1" : "0"}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value === "1" }))}
                      className={inputClass}
                    >
                      <option value="1">Active</option>
                      <option value="0">Inactive</option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">Note (optional)</span>
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                    className={inputClass}
                  />
                </label>

                {itemError && <p className="text-sm text-red-600">{itemError}</p>}

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowItemModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveItem}
                    disabled={
                      savingItem || !form.name.trim() || form.carriers.length === 0 ||
                      (form.price_type === "FIXED" && !form.price)
                    }
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    {savingItem ? "Saving..." : editingItem ? "Save Changes" : "Add"}
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
