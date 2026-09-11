export type AuthUser = {
  id: number;
  name: string;
  username: string;
  email: string;
};

const TOKEN_KEY = "access_token";
const EXPIRE_KEY = "access_token_expire";
const USER_KEY = "user";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function setAuth(data: { token: string; user: AuthUser }) {
  const expireAt = Date.now() + ONE_DAY_MS;
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(EXPIRE_KEY, expireAt.toString());
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function removeAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRE_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expireAt = localStorage.getItem(EXPIRE_KEY);

  if (!token || !expireAt) return null;

  if (Date.now() > Number(expireAt)) {
    removeAuth();
    return null;
  }

  return token;
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
