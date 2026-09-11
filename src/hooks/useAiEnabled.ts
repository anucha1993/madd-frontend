import { useEffect, useState } from "react";
import { getAiSettings } from "@/lib/ai";

// Shared admin on/off switch for all AI features (rate chat, AI Fill), configured
// in /config/integrations. Defaults to false until the settings call resolves, so
// AI entry points don't flash on then disappear.
export function useAiEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAiSettings()
      .then((res) => setEnabled(res.is_enabled))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, []);

  return { enabled, loading };
}
