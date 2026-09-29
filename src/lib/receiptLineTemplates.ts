import { apiClient } from "./apiClient";

export type ReceiptLineTemplateItem = {
  id?: number;
  description: string;
  // null = plain manual-entry line (staff types the amount by hand). When set, an expression
  // like "{FREIGHT CHARGE} * 12%" referencing an EARLIER line in the same template by its
  // description (case-insensitive, curly braces) — see lib/formulaEval.ts for evaluation.
  formula: string | null;
  is_non_vat: boolean;
};

export type ReceiptLineTemplate = {
  id: number;
  name: string;
  status: boolean;
  sort_order: number;
  items: ReceiptLineTemplateItem[];
};

export type ReceiptLineTemplateInput = {
  name: string;
  status?: boolean;
  items: ReceiptLineTemplateItem[];
};

export const listReceiptLineTemplates = () => apiClient.get<ReceiptLineTemplate[]>("/receipt-line-templates");

export const createReceiptLineTemplate = (data: ReceiptLineTemplateInput) =>
  apiClient.post<ReceiptLineTemplate>("/receipt-line-templates", data);

export const updateReceiptLineTemplate = (id: number, data: ReceiptLineTemplateInput) =>
  apiClient.put<ReceiptLineTemplate>(`/receipt-line-templates/${id}`, data);

export const deleteReceiptLineTemplate = (id: number) =>
  apiClient.delete<{ message: string }>(`/receipt-line-templates/${id}`);
