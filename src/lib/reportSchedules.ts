import { apiClient } from "./apiClient";

export type ReportScheduleFrequency = "daily" | "weekly" | "monthly";
export type ReportRange = "daily" | "weekly" | "monthly" | "yearly";

export type ReportSchedule = {
  id: number;
  name: string;
  report_type: string;
  frequency: ReportScheduleFrequency;
  send_time: string;
  day_of_week: number | null;
  day_of_month: number | null;
  report_range: ReportRange;
  branch_id: number | null;
  branch?: { id: number; name: string; code: string; nickname?: string | null } | null;
  carrier: "UPS" | "DHL" | null;
  agent_account_id: number | null;
  agent_account?: { id: number; username_acc: string } | null;
  recipients: string[];
  is_active: boolean;
  last_sent_at: string | null;
  last_sent_status: "success" | "failed" | null;
  last_error: string | null;
};

export type ReportScheduleInput = {
  name: string;
  frequency: ReportScheduleFrequency;
  send_time: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  report_range: ReportRange;
  branch_id?: number | null;
  carrier?: "UPS" | "DHL" | null;
  agent_account_id?: number | null;
  recipients: string[];
  is_active?: boolean;
};

export const listReportSchedules = () => apiClient.get<ReportSchedule[]>("/report-schedules");

export const createReportSchedule = (data: ReportScheduleInput) =>
  apiClient.post<ReportSchedule>("/report-schedules", data);

export const updateReportSchedule = (id: number, data: Partial<ReportScheduleInput>) =>
  apiClient.put<ReportSchedule>(`/report-schedules/${id}`, data);

export const deleteReportSchedule = (id: number) =>
  apiClient.delete<{ message: string }>(`/report-schedules/${id}`);

export const sendReportScheduleNow = (id: number) =>
  apiClient.post<{ message: string; output: string }>(`/report-schedules/${id}/send-now`, {});
