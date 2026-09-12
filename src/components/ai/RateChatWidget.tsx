"use client";

import { useState } from "react";
import { MessageCircleQuestion, Send, Sparkles, X } from "lucide-react";
import { askRateAi } from "@/lib/ai";
import type { RateQuote } from "@/lib/shipping";
import { useAiEnabled } from "@/hooks/useAiEnabled";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-brand-navy-dark focus:outline-none focus:ring-1 focus:ring-brand-navy-dark";

const EXAMPLE_QUESTIONS = [
  "ส่งกล่อง 2 กก. ไปสิงคโปร์ ราคาเท่าไหร่",
  "เอกสาร 500 กรัม ส่งไปอเมริกา ราคาเท่าไหร่",
  "ส่ง 3 กล่อง กล่องละ 4.5 กก. ไปญี่ปุ่น ราคาเท่าไหร่",
];

type ChatMessage = { role: "user" | "ai"; text: string; quotes?: RateQuote[] };

// Global floating launcher for the "ask AI about shipping rates" chat — available on
// every page instead of being embedded in a single form.
export default function RateChatWidget() {
  const { enabled: aiEnabled, loading: aiSettingsLoading } = useAiEnabled();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendQuestion(question: string) {
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await askRateAi(question);
      setMessages((prev) => [...prev, { role: "ai", text: res.reply, quotes: res.quotes }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAsk() {
    sendQuestion(input.trim());
  }

  // Hide the whole launcher once we know for sure AI is switched off in
  // /config/integrations — avoid a flash of the button while settings load.
  if (!aiSettingsLoading && !aiEnabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open && (
        <div className="mb-3 flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-500 to-sky-400 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-sm font-semibold">ถาม AI เรื่องเรทราคาส่ง</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            {messages.length === 0 ? (
              <div className="mb-3 flex flex-col gap-2">
                <p className="text-sm text-slate-400">
                  ลองถามเช่น — AI จะประเมินราคาจากต้นทางกรุงเทพฯ ให้ (ราคาจริงอาจต่างกันตามที่อยู่ต้นทาง)
                </p>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendQuestion(q)}
                      className="rounded-lg border border-violet-200 bg-violet-50/60 px-2.5 py-1.5 text-left text-xs text-violet-700 hover:bg-violet-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-brand-navy-dark text-white" : "bg-violet-50 text-slate-700"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.quotes && m.quotes.length > 0 && (
                      <div className="mt-1.5 flex w-full max-w-[85%] flex-col gap-1">
                        {["UPS", "DHL"].map((carrier) => {
                          const best = m.quotes!.filter((q) => q.carrier === carrier)[0];
                          if (!best) return null;
                          return (
                            <div key={carrier} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-700">{best.carrier} · {best.serviceLabel}</span>
                                <span className="text-slate-400">
                                  Acc: {best.username}
                                  {best.zone && ` · Zone ${best.zone}`}
                                  {best.transitDays != null && ` · ${best.transitDays} วัน`}
                                  {best.estimatedDelivery && ` · ถึง ${best.estimatedDelivery}`}
                                </span>
                              </div>
                              <span className="font-bold text-brand-navy-dark">
                                {(best.negotiated ?? best.published ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {best.currency}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="self-start rounded-xl bg-violet-50 px-3 py-2 text-sm text-slate-400">กำลังคิด...</div>
                )}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder="พิมพ์คำถาม เช่น ส่งไป... น้ำหนัก... ราคาเท่าไหร่"
                rows={2}
                className={`${inputClass} resize-none`}
              />
              <button
                type="button"
                onClick={handleAsk}
                disabled={loading || !input.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="ถาม AI เรื่องเรทราคาส่ง"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-400 text-white shadow-lg hover:shadow-xl"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>
    </div>
  );
}
