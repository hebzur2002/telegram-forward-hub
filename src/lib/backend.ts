// Backend API client for the FastAPI Telegram Auto Forward backend.
// Reads base URL from VITE_API_URL (preferred) or VITE_BACKEND_URL.

const BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  "";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: unknown) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export interface StoredUser {
  id: number | string;
  phone: string;
  role?: string;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

function url(path: string) {
  if (!BASE) {
    throw new Error("Backend URL not configured. Set VITE_API_URL.");
  }
  return `${BASE.replace(/\/$/, "")}${path}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url(path), { ...rest, headers: finalHeaders });
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Network error");
  }

  if (res.status === 401 || res.status === 403) {
    if (auth) {
      clearAuth();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
        window.location.replace("/auth");
      }
    }
    throw new Error("Session expired. Please sign in again.");
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && (body.detail || body.error || body.message)) ||
      (typeof body === "string" ? body : `Request failed (${res.status})`);
    throw new Error(String(msg));
  }
  return body as T;
}

// ---------- Types ----------

export interface SendOtpResponse {
  success: boolean;
  message?: string;
}
export interface VerifyOtpResponse {
  success?: boolean;
  requires_2fa?: boolean;
  token?: string;
  user?: StoredUser;
}

export interface Rule {
  id: number;
  user_id: number;
  rule_name: string;
  source_chat: string;
  target_chat: string;
  options: Record<string, any>;
  is_enabled: boolean;
  created_at: string | null;
}

export interface LogEntry {
  id: number;
  rule_id: number | null;
  source: string | null;
  target: string | null;
  message_type: string | null;
  status: string | null;
  error_reason: string | null;
  created_at: string | null;
}

export interface WorkerStatus {
  online: boolean;
  active_workers?: unknown;
}

export interface AdminUser {
  id: number;
  phone: string;
  role: string;
  is_suspended: boolean;
  created_at: string | null;
}

export interface AdminSession {
  id: number;
  user_id: number;
  last_active: string | null;
}

// ---------- API ----------

export const backend = {
  // Auth
  sendOtp: (phone: string) =>
    request<SendOtpResponse>("/auth/send-otp", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (payload: { phone: string; code: string; password?: string }) =>
    request<VerifyOtpResponse>("/auth/verify-otp", {
      method: "POST",
      auth: false,
      body: JSON.stringify(payload),
    }),

  // Rules
  listRules: () => request<{ rules: Rule[] }>("/rules/"),
  createRule: (data: Partial<Rule>) =>
    request<{ success: boolean; rule: Rule }>("/rules/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRule: (id: number, data: Partial<Rule>) =>
    request<{ success: boolean; rule: Rule }>(`/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRule: (id: number) =>
    request<{ success: boolean }>(`/rules/${id}`, { method: "DELETE" }),
  toggleRule: (id: number) =>
    request<{ success: boolean; is_enabled: boolean }>(`/rules/${id}/toggle`, {
      method: "PATCH",
    }),

  // Logs
  listLogs: (params: { page?: number; limit?: number; status?: string; rule_id?: number }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.rule_id) qs.set("rule_id", String(params.rule_id));
    const q = qs.toString();
    return request<{ logs: LogEntry[]; page: number }>(`/logs/${q ? `?${q}` : ""}`);
  },

  // Worker
  workerStatus: () => request<WorkerStatus>("/worker/status", { auth: false }),

  // Admin
  adminUsers: () => request<{ users: AdminUser[] }>("/admin/users"),
  adminSessions: () => request<{ sessions: AdminSession[] }>("/admin/sessions"),
  adminLogs: () => request<{ logs: LogEntry[] }>("/admin/logs"),
  adminSuspend: (id: number) =>
    request<{ success: boolean; is_suspended: boolean }>(`/admin/users/${id}/suspend`, {
      method: "PATCH",
    }),
  broadcast: (message: string) =>
    request<{ success: boolean }>("/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

export const isBackendConfigured = () => Boolean(BASE);
