"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Database, Loader2, Send, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import AiPlanBar from "@/components/ai/AiPlanBar";
import { askAdminAssistant, confirmAssistantAction, type AssistantAction, type AssistantPending } from "@/lib/ai";
import { ApiError } from "@/lib/apiClient";

type Message = {
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
  pending?: (AssistantPending & { state?: "confirming" | "done" | "cancelled"; result?: string })[];
  error?: boolean;
};

const EXAMPLES = [
  "ทำไม Shipment 1ZAX31730424456208 ราคาขายออกมาเท่านี้ ไล่ให้ดูทีละบรรทัด",
  "สูตร {BASE}*7% ของบัญชี 0279v4 คิดจากอะไร เมื่อใช้ Heavy Weight Rate",
  "SystemAlert ล่าสุดเกิดจากอะไร แก้ที่ไหน",
  "Rate Book ช่วง 71 kg ขึ้นไปคำนวณยังไง อยู่ใน Code ไฟล์ไหน",
];

/** ผู้ช่วย AI — Administrator only (the menu and the API both check). */
export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [planRefresh, setPlanRefresh] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      // Only the conversation itself goes back — error notes stay on screen.
      const history = next.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
      const res = await askAdminAssistant(history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply || "(ไม่มีคำตอบ)", actions: res.actions, pending: res.pending }]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) setPlanRefresh((n) => n + 1);
      setMessages((prev) => [...prev, { role: "assistant", content: err instanceof Error ? err.message : "เกิดข้อผิดพลาด", error: true }]);
    } finally {
      setLoading(false);
      setPlanRefresh((n) => n + 1);
    }
  }

  function updatePending(msgIndex: number, id: string, patch: Partial<NonNullable<Message["pending"]>[number]>) {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, pending: m.pending?.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : m)),
    );
  }

  async function confirm(msgIndex: number, p: AssistantPending) {
    updatePending(msgIndex, p.id, { state: "confirming" });
    try {
      const res = await confirmAssistantAction(p.id);
      updatePending(msgIndex, p.id, { state: "done", result: `ทำแล้ว — มีผล ${res.affected_rows} แถว` });
      // Tell the assistant, so its next answer knows the change happened.
      setMessages((prev) => [...prev, { role: "assistant", content: `✓ Administrator ยืนยันแล้ว: ${p.purpose || p.sql} — มีผล ${res.affected_rows} แถว` }]);
    } catch (err) {
      updatePending(msgIndex, p.id, { state: undefined, result: err instanceof Error ? err.message : "ทำไม่สำเร็จ" });
    }
  }

  function cancel(msgIndex: number, p: AssistantPending) {
    updatePending(msgIndex, p.id, { state: "cancelled", result: "ยกเลิกแล้ว — ไม่ได้แก้ข้อมูล" });
    setMessages((prev) => [...prev, { role: "assistant", content: `✗ Administrator ยกเลิก: ${p.purpose || p.sql} — ไม่ได้ทำ` }]);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-5xl flex-col">
      <PageHeader
        title="ผู้ช่วย AI"
        description="ถามเรื่องเทคนิคของระบบ — อ่าน Code / Log / ข้อมูลจริง ไล่หาสาเหตุราคา สูตร และ Error ได้ · แก้ข้อมูลได้ (ลบ / หลายแถว / สิทธิ์ ต้องกดยืนยัน) · แก้ Code / โครงสร้างตาราง และจองกับ Carrier ไม่ได้ · ทุกการแก้ไขบันทึกใน Audit Log"
      />
      <AiPlanBar refreshKey={planRefresh} />

      <div className="mt-3 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500">
            <Bot className="h-10 w-10 text-slate-300" />
            <p className="text-sm">ลองถาม เช่น</p>
            <div className="flex max-w-2xl flex-wrap justify-center gap-2">
              {EXAMPLES.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-brand-navy-dark text-white" : m.error ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-800"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{m.content}</div>

              {!!m.actions?.length && (
                <details className="mt-2 text-xs text-slate-500">
                  <summary className="flex cursor-pointer list-none items-center gap-1">
                    <Database className="h-3.5 w-3.5" /> ใช้ SQL {m.actions.length} คำสั่ง
                    {m.actions.some((a) => a.type === "write") && <span className="font-semibold text-amber-600">· มีการแก้ข้อมูล</span>}
                    <ChevronDown className="h-3 w-3" />
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {m.actions.map((a, j) => (
                      <li key={j} className="rounded bg-white px-2 py-1 font-mono text-[11px]">
                        <span className={a.type === "write" ? "text-amber-600" : a.type === "error" ? "text-red-600" : "text-slate-400"}>
                          [{a.type === "write" ? `แก้ ${a.rows} แถว` : a.type === "error" ? "ผิดพลาด" : `อ่าน ${a.rows} แถว`}]
                        </span>{" "}
                        {a.sql}
                        {a.error && <div className="text-red-600">{a.error}</div>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {m.pending?.map((p) => (
                <div key={p.id} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-semibold">
                    รอยืนยัน: {p.purpose || "แก้ข้อมูล"} · {p.reason} · จะมีผล {p.affected_rows} แถว
                  </p>
                  <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-700">{p.sql}</pre>
                  {p.state === "done" || p.state === "cancelled" ? (
                    <p className={`mt-2 font-semibold ${p.state === "done" ? "text-emerald-700" : "text-slate-500"}`}>{p.result}</p>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => confirm(i, p)}
                        disabled={p.state === "confirming"}
                        className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        {p.state === "confirming" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} ยืนยัน
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel(i, p)}
                        disabled={p.state === "confirming"}
                        className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <X className="h-3.5 w-3.5" /> ยกเลิก
                      </button>
                      {p.result && <span className="text-red-600">{p.result}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> กำลังค้นข้อมูล…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="พิมพ์คำถามหรือสิ่งที่ต้องการให้ทำ… (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)"
          className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-brand-amber px-4 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> ส่ง
        </button>
      </form>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">
        ผู้ช่วย AI ของระบบ MADD · ออกแบบและพัฒนาโดย อนุชา โยธานันท์ · คำตอบเรียบเรียงจาก Code, Log และข้อมูลจริงผ่านฟังก์ชันของระบบ — ควรตรวจสอบก่อนนำไปใช้
      </p>
    </div>
  );
}
