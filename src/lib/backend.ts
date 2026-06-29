// Thin client for the Python backend (Telegram OTP + worker).
// Reads from VITE_BACKEND_URL or falls back to NEXT_PUBLIC_BACKEND_URL if set.

const BASE =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_BACKEND_URL as string | undefined) ||
  "";

function url(path: string) {
  if (!BASE) {
    throw new Error(
      "Backend URL is not configured. Set VITE_BACKEND_URL in your environment.",
    );
  }
  return `${BASE.replace(/\/$/, "")}${path}`;
}

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).error)
        : typeof body === "string"
          ? body
          : `Request failed with status ${res.status}`);
    throw new Error(msg);
  }
  return body as T;
}

export interface SendOtpResponse {
  ok: boolean;
  phone_code_hash?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token: string;
  user?: { id: string; phone: string; role?: string };
}

export interface WorkerStatusResponse {
  online: boolean;
  uptime_seconds?: number;
  version?: string;
  last_seen?: string;
}

export const backend = {
  sendOtp: (phone: string) =>
    jsonRequest<SendOtpResponse>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),
  verifyOtp: (payload: { phone: string; code: string; phone_code_hash?: string }) =>
    jsonRequest<VerifyOtpResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  workerStatus: () => jsonRequest<WorkerStatusResponse>("/worker/status"),
  broadcast: (message: string) =>
    jsonRequest<{ ok: boolean; delivered?: number }>("/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

export const isBackendConfigured = () => Boolean(BASE);
