"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { login, LoginError } from "@/lib/authApi";
import { setAuth } from "@/lib/auth";
import LoginSuccessAnimation from "./LoginSuccessAnimation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [welcomeName, setWelcomeName] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await login(username.trim(), password);
      setAuth({ token, user });
      setWelcomeName(user.name);
    } catch (err) {
      setError(err instanceof LoginError ? err.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  if (welcomeName) {
    return <LoginSuccessAnimation userName={welcomeName} onComplete={() => router.push("/dashboard")} />;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-600">ชื่อผู้ใช้</span>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="กรอกชื่อผู้ใช้"
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-600">รหัสผ่าน</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่าน"
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          >
            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
          </button>
        </div>
      </label>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-slate-500">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand-amber" />
          จดจำฉัน
        </label>
        <a href="#" className="font-medium text-brand-navy hover:underline">
          ลืมรหัสผ่าน?
        </a>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 w-full rounded-lg bg-brand-navy-dark py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-dark/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
