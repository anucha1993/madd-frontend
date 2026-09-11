import { apiClient } from "./apiClient";

export type ProductWeightBand = {
  id: number;
  code: string;
  label: string;
  package_type: "box" | "document";
  min_weight: string | number | null;
  max_weight: string | number | null;
  sort_order: number;
  status: boolean;
};

export const listProductWeightBands = () => apiClient.get<ProductWeightBand[]>("/product-weight-bands");

export type ProductWeightBandInput = {
  code: string;
  label: string;
  package_type: "box" | "document";
  min_weight?: number | null;
  max_weight?: number | null;
  status?: boolean;
};

export const createProductWeightBand = (data: ProductWeightBandInput) =>
  apiClient.post<ProductWeightBand>("/product-weight-bands", data);

export const updateProductWeightBand = (id: number, data: Partial<ProductWeightBandInput>) =>
  apiClient.put<ProductWeightBand>(`/product-weight-bands/${id}`, data);

export const deleteProductWeightBand = (id: number) =>
  apiClient.delete<{ message: string }>(`/product-weight-bands/${id}`);

/** Auto-match a weight band by total shipment weight (kg) and package type — mirrors the
 * legacy system's manual "Shipment Weight Range" picker, but computed automatically. */
export function matchProductWeightBand(
  bands: ProductWeightBand[],
  totalWeight: number,
  packageType: "box" | "document"
): ProductWeightBand | null {
  if (packageType === "document") {
    return bands.find((b) => b.package_type === "document") ?? null;
  }
  return (
    bands.find((b) => {
      if (b.package_type !== "box" || b.min_weight == null || b.max_weight == null) return false;
      return totalWeight >= Number(b.min_weight) && totalWeight <= Number(b.max_weight);
    }) ?? null
  );
}

/** Some supplies (e.g. CPM10/CPM25 boxes) force a fixed Weight Range regardless of actual
 * weight — those bands are excluded from automatic weight-based matching (see above) and
 * only apply when the linked supply was explicitly selected. If more than one forced band
 * is present in a shipment, the one with the highest max weight wins (billed conservatively). */
export function pickForcedWeightBand(bands: ProductWeightBand[], forcedBandIds: number[]): ProductWeightBand | null {
  const forced = bands.filter((b) => forcedBandIds.includes(b.id));
  if (forced.length === 0) return null;
  return forced.reduce((best, b) => (Number(b.max_weight ?? 0) > Number(best.max_weight ?? 0) ? b : best));
}
