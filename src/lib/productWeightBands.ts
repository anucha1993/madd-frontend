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
