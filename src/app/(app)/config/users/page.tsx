"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import UserForm from "@/components/config/UserForm";
import { listBranches, type Branch } from "@/lib/branches";
import { createUser, deleteUser, listUsers, updateUser, type AppUser, type AppUserInput } from "@/lib/users";
import { getUser } from "@/lib/auth";

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalUser, setModalUser] = useState<AppUser | "new" | null>(null);
  const currentUser = getUser();

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [usersRes, branchesRes] = await Promise.all([listUsers(), listBranches()]);
      setUsers(usersRes);
      setBranches(branchesRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(data: AppUserInput) {
    if (modalUser && modalUser !== "new") {
      await updateUser(modalUser.id, data);
    } else {
      await createUser(data);
    }
    setModalUser(null);
    await loadAll();
  }

  async function handleDelete(user: AppUser) {
    if (!confirm(`ยืนยันลบผู้ใช้งาน "${user.name}" ?`)) return;
    await deleteUser(user.id);
    await loadAll();
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="สมาชิกและสิทธิ์การใช้งาน" description="จัดการผู้ใช้งานและกำหนดสิทธิ์การเข้าถึงสาขา" />
        <button
          type="button"
          onClick={() => setModalUser("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          เพิ่มผู้ใช้งาน
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="Loading Users..." />
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <UsersIcon className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">ยังไม่มีผู้ใช้งานในระบบ</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">ชื่อ</th>
                <th className="px-5 py-2.5 font-medium">ชื่อผู้ใช้</th>
                <th className="px-5 py-2.5 font-medium">Role</th>
                <th className="px-5 py-2.5 font-medium">สิทธิ์เข้าถึงสาขา</th>
                <th className="px-5 py-2.5 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">{user.name}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{user.username}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.role === "admin" ? "bg-brand-amber/20 text-brand-navy-dark" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {user.role === "admin" ? "Admin" : "Staff"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {user.can_access_all_branches
                      ? "ทุกสาขา"
                      : user.branches.length > 0
                        ? user.branches.map((b) => b.name).join(", ")
                        : "-"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setModalUser(user)}
                      className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="แก้ไข"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      disabled={currentUser?.id === user.id}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="ลบ"
                      title={currentUser?.id === user.id ? "ไม่สามารถลบบัญชีของตัวเองได้" : "ลบ"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalUser && (
        <Modal
          title={modalUser === "new" ? "เพิ่มผู้ใช้งาน" : `แก้ไขผู้ใช้งาน ${modalUser.name}`}
          onClose={() => setModalUser(null)}
        >
          <UserForm
            branches={branches}
            initial={modalUser === "new" ? null : modalUser}
            onSubmit={handleSubmit}
            onCancel={() => setModalUser(null)}
          />
        </Modal>
      )}
    </div>
  );
}
