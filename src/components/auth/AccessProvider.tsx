"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { can, canEditField, canSeeField, fieldLevel, NO_ACCESS, type Access } from "@/lib/access";

const AccessContext = createContext<Access>(NO_ACCESS);

export function AccessProvider({ access, children }: { access: Access; children: ReactNode }) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

/**
 * Current user's access, bound helpers included:
 *   const { can, canSeeField } = useAccess();
 *   can("shipment.void"); canSeeField("shipment", "cost");
 */
export function useAccess() {
  const access = useContext(AccessContext);

  return useMemo(
    () => ({
      access,
      can: (permission: string | string[]) => can(access, permission),
      fieldLevel: (module: string, group: string) => fieldLevel(access, module, group),
      canSeeField: (module: string, group: string) => canSeeField(access, module, group),
      canEditField: (module: string, group: string) => canEditField(access, module, group),
    }),
    [access],
  );
}
