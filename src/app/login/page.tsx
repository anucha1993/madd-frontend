import type { Metadata } from "next";
import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | MADD Admin",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-1 flex-col items-center justify-center overflow-hidden bg-brand-navy-dark px-4 py-12">
      {/* decorative geometric background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rotate-12 rounded-3xl bg-brand-navy/60" />
        <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rotate-45 rounded-[3rem] bg-brand-navy/40" />
        <div className="absolute bottom-[-8rem] left-1/4 h-72 w-72 rotate-[24deg] rounded-3xl bg-brand-amber/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-navy-dark/40 to-brand-navy-dark" />
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.png" alt="MADD" width={140} height={45} className="h-auto w-35" priority />
          <h1 className="text-xl font-bold text-slate-800">เข้าสู่ระบบ</h1>
          <p className="text-sm text-slate-500">ระบบจัดการงานขนส่ง MADD</p>
        </div>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>

      <p className="relative z-10 mt-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} MADD. สงวนลิขสิทธิ์.
      </p>
    </div>
  );
}
