"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { TruckRouteGraphic } from "@/components/ui/LoadingTruck";

type Props = {
  userName: string;
  onComplete: () => void;
};

const ROUTE_MS = 2400;
const WELCOME_MS = 1400;

export default function LoginSuccessAnimation({ userName, onComplete }: Props) {
  const [phase, setPhase] = useState<"route" | "welcome">("route");

  useEffect(() => {
    const toWelcome = setTimeout(() => setPhase("welcome"), ROUTE_MS);
    const finish = setTimeout(onComplete, ROUTE_MS + WELCOME_MS);
    return () => {
      clearTimeout(toWelcome);
      clearTimeout(finish);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy-dark">
      {phase === "route" ? (
        <TruckRouteGraphic label="Signing in..." />
      ) : (
        <div className="animate-welcome-pop flex flex-col items-center gap-3 px-6 text-center">
          <PartyPopper className="h-14 w-14 text-brand-amber" />
          <h1 className="text-3xl font-bold text-white"># ยินดีต้อนรับ</h1>
          <p className="text-lg text-slate-200">{userName}</p>
        </div>
      )}
    </div>
  );
}
