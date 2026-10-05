"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Download, FlaskConical, KeyRound, Pencil, Plus, Puzzle, RefreshCw, Trash2 } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import { CopyButton } from "@/components/shipment/VoidShipmentModal";
import { API_URL } from "@/lib/apiUrl";
import { listBranches, branchLabel, type Branch } from "@/lib/branches";
import {
  createApiClient,
  deleteApiClient,
  downloadWordPressPlugin,
  listWordPressPlugins,
  listApiClients,
  listApiRequestLogs,
  regenerateApiKey,
  testApiClient,
  updateApiClient,
  type ApiClientInput,
  type ApiClientRecord,
  type ApiRequestLog,
  type PublicRateOption,
  type WordPressPlugin,
} from "@/lib/apiClients";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

const ENDPOINT = `${API_URL}/public/v1/rates`;
const TRACKING_ENDPOINT = `${API_URL}/public/v1/tracking/{tracking_number}`;

const EMPTY: ApiClientInput = {
  name: "",
  branch_id: null,
  origin_city: "Bangkok",
  origin_postcode: "10110",
  carriers: null,
  max_results: 6,
  price_rounding: 0,
  rate_limit_per_minute: 60,
  end_user_limit_per_minute: 10,
  allowed_ips: null,
  browser_origins: null,
  allow_rates: true,
  allow_tracking: true,
  track_any_number: false,
  external_tracking_daily_limit: 500,
  status: true,
};

const errorText = (err: unknown) => (err instanceof Error ? err.message : "เกิดข้อผิดพลาด");

export default function ApiClientsPage() {
  const { can } = useAccess();
  const [clients, setClients] = useState<ApiClientRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ApiClientRecord | "new" | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ name: string; key: string } | null>(null);
  const [testing, setTesting] = useState<ApiClientRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listApiClients(), listBranches()])
      .then(([c, b]) => {
        if (cancelled) return;
        setClients(c);
        setBranches(b);
        setError("");
      })
      .catch((err) => !cancelled && setError(errorText(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const refresh = () => setReload((n) => n + 1);

  async function handleRegenerate(client: ApiClientRecord) {
    if (!confirm(`สร้าง API Key ใหม่ให้ "${client.name}"?\nKey เดิมจะใช้งานไม่ได้ทันที ต้องนำ Key ใหม่ไปใส่ที่เว็บไซต์`)) return;
    try {
      const res = await regenerateApiKey(client.id);
      setRevealedKey({ name: client.name, key: res.api_key });
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function handleDelete(client: ApiClientRecord) {
    if (!confirm(`ลบ "${client.name}"? เว็บไซต์ที่ใช้ Key นี้จะเช็คราคาไม่ได้ทันที`)) return;
    try {
      await deleteApiClient(client.id);
      refresh();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="relative min-h-[360px] space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Public API"
          description="API Key ให้เว็บไซต์ภายนอก (เช่น WordPress) เช็คราคาขาย — ราคาเดียวกับหน้าร้าน (รวม Mark-up แล้ว) ไม่เปิดเผยต้นทุน / Mark-up / เลขบัญชี Carrier"
        />
        <div className="flex shrink-0 gap-2">
        <Link href="/config/api-clients/stats" className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <BarChart3 className="h-4 w-4" />
          สถิติการใช้งาน
        </Link>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" />
            สร้าง API Key
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-slate-800">Endpoints</span>
          <CopyButton text={API_URL} label="คัดลอก URL สำหรับ Plugin" />
        </div>
        <div className="space-y-1.5">
          <code className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs">POST {ENDPOINT} — เช็คราคาขาย</code>
          <code className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs">GET {TRACKING_ENDPOINT} — ติดตามพัสดุ (เฉพาะ Shipment ที่จองใน MADD, ไม่มีชื่อ/ที่อยู่/ราคา)</code>
          <code className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs">GET {API_URL}/public/v1/countries — รายชื่อประเทศปลายทาง</code>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          เรียกจาก Server ของเว็บไซต์เท่านั้น (เช่น Plugin WordPress) ห้ามใส่ Key ใน JavaScript ฝั่ง Browser · ส่ง Header <code>Authorization: Bearer &lt;API Key&gt;</code> และ{" "}
          <code>X-End-User-IP</code> (IP ของลูกค้า เพื่อจำกัดการยิงต่อคน)
        </p>
      </div>

      {loading ? (
        <PageLoading label="Loading..." />
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <KeyRound className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">ยังไม่มี API Key</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อ</th>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">สาขา / ต้นทาง</th>
                <th className="px-4 py-2.5 font-medium">Carrier</th>
                <th className="px-4 py-2.5 font-medium">ใช้ได้</th>
                <th className="px-4 py-2.5 text-right font-medium">เรียกใช้ 30 วัน</th>
                <th className="px-4 py-2.5 font-medium">ใช้ล่าสุด</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{c.key_prefix ? `${c.key_prefix}…` : "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {c.branch ? branchLabel(c.branch) : "ทุกบัญชี Carrier"}
                    <div className="text-xs text-slate-400">
                      {c.origin_city} {c.origin_postcode}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.carriers?.join(", ") ?? "UPS, DHL"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{[c.allow_rates && "เช็คราคา", c.allow_tracking && "Tracking"].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {(c.calls_30d ?? 0).toLocaleString()}
                    {!!c.failed_30d && <div className="text-xs text-red-500">ไม่สำเร็จ {c.failed_30d.toLocaleString()}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{c.last_used_at ? new Date(c.last_used_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {c.status ? "เปิดใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {can("config.api_clients_test") && (
                        <button type="button" onClick={() => setTesting(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="ทดสอบเช็คราคา">
                          <FlaskConical className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="แก้ไข">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {can("config.api_clients_regenerate") && (
                        <button type="button" onClick={() => handleRegenerate(c)} className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50" title="สร้าง Key ใหม่">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(c)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" title="ลบ">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {can("config.wordpress_plugin") && <WordPressPlugins />}

      <RequestLogs clients={clients} reloadKey={reload} />

      {editing && (
        <ClientForm
          client={editing === "new" ? null : editing}
          branches={branches}
          onClose={() => setEditing(null)}
          onSaved={(key, name) => {
            setEditing(null);
            if (key) setRevealedKey({ key, name });
            refresh();
          }}
        />
      )}

      {revealedKey && (
        <Modal title="API Key" onClose={() => setRevealedKey(null)}>
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              คัดลอก Key ของ <b>{revealedKey.name}</b> ไปใส่ที่เว็บไซต์ตอนนี้ — ระบบจะไม่แสดง Key นี้อีก (ถ้าหาย ให้สร้าง Key ใหม่)
            </p>
            <code className="block break-all rounded-lg bg-slate-900 px-3 py-3 font-mono text-xs text-emerald-300">{revealedKey.key}</code>
            <div className="flex justify-end">
              <CopyButton text={revealedKey.key} label="คัดลอก Key" />
            </div>
          </div>
        </Modal>
      )}

      {testing && <TestModal client={testing} onClose={() => setTesting(null)} />}
    </div>
  );
}

function ClientForm({ client, branches, onClose, onSaved }: { client: ApiClientRecord | null; branches: Branch[]; onClose: () => void; onSaved: (key: string | null, name: string) => void }) {
  const [form, setForm] = useState<ApiClientInput>(client ? { ...EMPTY, ...client } : EMPTY);
  const [ips, setIps] = useState((client?.allowed_ips ?? []).join("\n"));
  const [origins, setOrigins] = useState((client?.browser_origins ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof ApiClientInput>(key: K, value: ApiClientInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const carriers = form.carriers ?? ["UPS", "DHL"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      ...form,
      carriers: carriers.length === 2 ? null : carriers,
      allowed_ips: ips.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
      browser_origins: origins.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (client) {
        await updateApiClient(client.id, body);
        onSaved(null, form.name);
      } else {
        const res = await createApiClient(body);
        onSaved(res.api_key, form.name);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const numberField = (key: "max_results" | "rate_limit_per_minute" | "end_user_limit_per_minute", label: string, hint?: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input type="number" min={key === "end_user_limit_per_minute" ? 0 : 1} value={form[key]} onChange={(e) => set(key, Number(e.target.value))} className={inputClass} />
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );

  return (
    <Modal title={client ? `แก้ไข ${client.name}` : "สร้าง API Key"} onClose={onClose} maxWidthClassName="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">ชื่อ (เช่น เว็บไซต์หลัก WordPress) *</span>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={100} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">ใช้บัญชี Carrier ของสาขา</span>
            <select value={form.branch_id ?? ""} onChange={(e) => set("branch_id", e.target.value ? Number(e.target.value) : null)} className={inputClass}>
              <option value="">ทุกบัญชีที่เปิดใช้งาน</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchLabel(b)}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">บัญชีและบริการที่อนุญาตตามหน้า Branches</span>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Carrier ที่แสดง</span>
            <div className="flex gap-4 pt-2">
              {(["UPS", "DHL"] as const).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={carriers.includes(c)}
                    onChange={(e) => set("carriers", e.target.checked ? [...carriers, c] : carriers.filter((x) => x !== c))}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">ต้นทางมาตรฐาน — เมือง</span>
            <input required value={form.origin_city} onChange={(e) => set("origin_city", e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">ต้นทางมาตรฐาน — รหัสไปรษณีย์</span>
            <input required pattern="\d{5}" value={form.origin_postcode} onChange={(e) => set("origin_postcode", e.target.value)} className={inputClass} />
          </label>
          {numberField("max_results", "จำนวนตัวเลือกสูงสุด")}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">ปัดราคาขึ้น</span>
            <select value={form.price_rounding} onChange={(e) => set("price_rounding", Number(e.target.value))} className={inputClass}>
              <option value={0}>ไม่ปัด (ตรงกับหน้าร้าน)</option>
              {[1, 5, 10, 50, 100].map((n) => (
                <option key={n} value={n}>
                  ขึ้นเป็นหลัก {n} บาท
                </option>
              ))}
            </select>
          </label>
          {numberField("rate_limit_per_minute", "จำกัดต่อ Key (ครั้ง/นาที)")}
          {numberField("end_user_limit_per_minute", "จำกัดต่อลูกค้า 1 IP (ครั้ง/นาที)", "0 = ไม่จำกัด")}
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">IP ของ Server เว็บไซต์ที่อนุญาต (ไม่บังคับ)</span>
            <textarea value={ips} onChange={(e) => setIps(e.target.value)} rows={2} placeholder="เช่น 203.0.113.10 หรือ 203.0.113.0/24 — เว้นว่าง = ทุก IP" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-600">เว็บไซต์ที่ให้ Browser ของลูกค้าเรียกได้โดยตรง — Tracking และเช็คราคา (ไม่บังคับ)</span>
            <textarea value={origins} onChange={(e) => setOrigins(e.target.value)} rows={2} placeholder={"เช่น https://madd.co.th\nhttps://www.madd.co.th"} className={inputClass} />
            <span className="text-xs text-slate-400">
              ใช้กับ Plugin MADD Tracking 1.2+ / MADD Rate Quote — Browser ของลูกค้าเรียก MADD เอง (ไม่ผ่าน Server เว็บ, ไม่ใช้ API Key) เฉพาะ Tracking และราคาขาย ตามที่เปิดสิทธิ์ไว้ · จำกัดครั้งต่อ IP ลูกค้าตามช่องด้านบน
            </span>
          </label>
          <div className="flex flex-wrap gap-5 text-sm sm:col-span-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.allow_rates} onChange={(e) => set("allow_rates", e.target.checked)} />
              ใช้เช็คราคาได้
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.allow_tracking} onChange={(e) => set("allow_tracking", e.target.checked)} />
              ใช้ติดตามพัสดุได้
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.status} onChange={(e) => set("status", e.target.checked)} />
              เปิดใช้งาน Key
            </label>
          </div>
          {form.allow_tracking && (
            <div className="flex flex-wrap items-end gap-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm sm:col-span-2">
              <label className="flex max-w-md items-start gap-2">
                <input type="checkbox" className="mt-1" checked={form.track_any_number} onChange={(e) => set("track_any_number", e.target.checked)} />
                <span>
                  ค้นเลขที่ไม่ได้จองผ่าน MADD ได้ด้วย (UPS / DHL)
                  <span className="block text-xs text-slate-500">ใช้บัญชี Carrier ของเราค้นให้ — เช่น Shipment ก่อนมี MADD หรือจองที่เว็บ Carrier เอง · แสดงเฉพาะสถานะ/จุดสแกน</span>
                </span>
              </label>
              {form.track_any_number && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-600">จำกัดต่อวัน (ครั้ง, 0 = ไม่จำกัด)</span>
                  <input type="number" min={0} value={form.external_tracking_daily_limit} onChange={(e) => set("external_tracking_daily_limit", Number(e.target.value))} className={`${inputClass} w-32`} />
                </label>
              )}
            </div>
          )}
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : client ? "บันทึก" : "สร้าง Key"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TestModal({ client, onClose }: { client: ApiClientRecord; onClose: () => void }) {
  const [country, setCountry] = useState("SG");
  const [weight, setWeight] = useState("2");
  const [type, setType] = useState<"parcel" | "document">("parcel");
  const [running, setRunning] = useState(false);
  const [options, setOptions] = useState<PublicRateOption[] | null>(null);
  const [error, setError] = useState("");

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError("");
    try {
      const res = await testApiClient(client.id, { destination: { country }, shipment_type: type, packages: [{ weight: Number(weight) }] });
      setOptions(res.options);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal title={`ทดสอบ — ${client.name}`} onClose={onClose} maxWidthClassName="max-w-xl">
      <form onSubmit={run} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ประเทศ (ISO 2)</span>
          <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} className={`${inputClass} w-24`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">น้ำหนัก (kg)</span>
          <input type="number" min={0.1} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} className={`${inputClass} w-28`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ประเภท</span>
          <select value={type} onChange={(e) => setType(e.target.value as "parcel" | "document")} className={`${inputClass} w-32`}>
            <option value="parcel">พัสดุ</option>
            <option value="document">เอกสาร</option>
          </select>
        </label>
        <button type="submit" disabled={running} className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {running ? "กำลังเช็ค..." : "เช็คราคา"}
        </button>
      </form>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {options &&
        (options.length === 0 ? (
          <p className="text-sm text-slate-500">ไม่ได้ราคาจาก Carrier — ตรวจบัญชี Carrier ของสาขา / ดู System Alerts</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {options.map((o) => (
                <tr key={`${o.carrier}-${o.service_code}`} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-medium text-slate-700">{o.carrier}</td>
                  <td className="py-2 text-slate-600">{o.service_name}</td>
                  <td className="py-2 text-slate-500">{o.transit_days ? `${o.transit_days} วัน` : ""}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">
                    {o.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} {o.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      <p className="mt-3 text-xs text-slate-400">ข้อมูลเดียวกับที่เว็บไซต์ได้รับ (ไม่ใช้ Cache และไม่นับรวมในสถิติ)</p>
    </Modal>
  );
}

function WordPressPlugins() {
  const [plugins, setPlugins] = useState<WordPressPlugin[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listWordPressPlugins()
      .then((res) => !cancelled && setPlugins(res))
      .catch((err) => !cancelled && setError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function download(plugin: WordPressPlugin) {
    setDownloading(plugin.slug);
    setError("");
    try {
      await downloadWordPressPlugin(plugin);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Puzzle className="h-4 w-4 text-brand-navy" />
        <h2 className="text-sm font-semibold text-slate-800">WordPress Plugin</h2>
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {plugins.map((p) => (
          <div key={p.slug} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div className="min-w-0 text-sm">
              <div className="font-semibold text-slate-800">
                {p.name} {p.version && <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">v{p.version}</span>}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{p.summary}</div>
              <div className="mt-1 text-[11px] text-slate-400">อัปเดต {new Date(p.updated_at).toLocaleDateString()}</div>
            </div>
            <button
              type="button"
              disabled={downloading === p.slug}
              onClick={() => download(p)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-navy-dark px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === p.slug ? "กำลังเตรียม..." : "ดาวน์โหลด .zip"}
            </button>
          </div>
        ))}
      </div>
      <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-xs text-slate-500">
        <li>WordPress › Plugins › Add New › Upload Plugin › เลือกไฟล์ .zip › Install › Activate</li>
        <li>
          ใส่ใน <code>wp-config.php</code>: <code>define(&apos;MADD_RATE_API_URL&apos;, &apos;{API_URL}&apos;);</code> และ{" "}
          <code>define(&apos;MADD_RATE_API_KEY&apos;, &apos;madd_...&apos;);</code> (หรือกรอกที่หน้า Settings ของ Plugin)
        </li>
        <li>กด &quot;ทดสอบ&quot; ที่หน้า Settings ของ Plugin แล้วใส่ shortcode ในหน้าเว็บ — ติดตั้งได้ทั้ง 2 ตัวพร้อมกัน (Rate Quote ใช้ URL / Key เดียวกับ Tracking) · อย่าลืมใส่เว็บไซต์ในช่อง &quot;Browser เรียกได้โดยตรง&quot; ของ Key</li>
      </ol>
    </div>
  );
}

function RequestLogs({ clients, reloadKey }: { clients: ApiClientRecord[]; reloadKey: number }) {
  const [filters, setFilters] = useState<{ api_client_id?: number; status?: "ok" | "failed"; endpoint?: "rates" | "tracking" }>({});
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ApiRequestLog[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listApiRequestLogs({ ...filters, page })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadKey]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-800">ประวัติการเรียกใช้</h2>
        <div className="flex gap-2">
          <select
            value={filters.api_client_id ?? ""}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, api_client_id: e.target.value ? Number(e.target.value) : undefined });
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">ทุก Key</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status ?? ""}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, status: (e.target.value || undefined) as "ok" | "failed" | undefined });
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">ทุกสถานะ</option>
            <option value="ok">สำเร็จ</option>
            <option value="failed">ไม่สำเร็จ</option>
          </select>
          <select
            value={filters.endpoint ?? ""}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, endpoint: (e.target.value || undefined) as "rates" | "tracking" | undefined });
            }}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="">ทุก API</option>
            <option value="rates">เช็คราคา</option>
            <option value="tracking">Tracking (Server)</option>
            <option value="web_tracking">Tracking (Browser)</option>
            <option value="web_rates">เช็คราคา (Browser)</option>
          </select>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">ยังไม่มีการเรียกใช้</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">เวลา</th>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">API</th>
                <th className="px-4 py-2 font-medium">ปลายทาง</th>
                <th className="px-4 py-2 text-right font-medium">น้ำหนักรวม</th>
                <th className="px-4 py-2 text-right font-medium">ราคาต่ำสุด</th>
                <th className="px-4 py-2 font-medium">ผล</th>
                <th className="px-4 py-2 font-medium">IP ลูกค้า</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{r.api_client?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {{ rates: "เช็คราคา", web_rates: "เช็คราคา (Browser)", tracking: "Tracking", web_tracking: "Tracking (Browser)" }[r.endpoint] ?? r.endpoint}
                    {r.reference && <div className="font-mono text-slate-400">{r.reference}</div>}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.destination_country ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.total_weight != null ? `${r.total_weight} kg` : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.lowest_price != null ? r.lowest_price.toLocaleString() : "—"}</td>
                  <td className="px-4 py-2">
                    {r.status_code === 200 ? (
                      <span className="text-emerald-700">
                        {r.result_count} {r.endpoint.endsWith("rates") ? "ตัวเลือก" : "จุดสแกน"}
                        {r.cached ? " · cache" : ""}
                        {r.duration_ms != null && <span className="text-slate-400"> · {r.duration_ms} ms</span>}
                      </span>
                    ) : (
                      <span className="text-red-600" title={r.error ?? ""}>
                        {r.status_code} {r.error ? `· ${r.error.slice(0, 60)}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-400">{r.end_user_ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>ทั้งหมด {total.toLocaleString()} รายการ</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ก่อนหน้า
              </button>
              <span>
                {page} / {lastPage}
              </span>
              <button type="button" disabled={page >= lastPage} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
