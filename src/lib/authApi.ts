import type { AuthUser } from "./auth";
import { API_URL } from "./apiUrl";

export class LoginError extends Error {}

export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new LoginError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data?.errors?.username?.[0] ?? data?.message ?? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    throw new LoginError(message);
  }

  return data as { token: string; user: AuthUser };
}
