# Telegram Auto Forward — Build Plan

A SaaS app for managing Telegram message forwarding rules with phone+OTP auth, rules CRUD, logs, and an admin panel.

## Stack note (important)

You asked for Next.js, but this Lovable project is built on **TanStack Start** (React 19 + Vite + Tailwind v4), not Next.js. I'll build on the existing stack — same React + Tailwind + shadcn experience, file-based routing under `src/routes/`, and server logic via TanStack server functions. Persistence/auth uses **Lovable Cloud** (managed Supabase under the hood). If you need a true Next.js codebase instead, tell me and I'll stop.

## Auth flow

- Public `/auth` route: phone input → OTP input (two-step).
- "Send OTP" calls `POST {NEXT_PUBLIC_BACKEND_URL}/auth/send-otp` with `{ phone }`.
- "Verify OTP" calls `POST .../auth/verify-otp` with `{ phone, code }`. Expected response includes a Supabase session (access/refresh token) minted by your Python backend for that user, plus `session_string` to store.
- We call `supabase.auth.setSession(...)` on the returned tokens → standard JWT session, RLS works.
- Logout = `supabase.auth.signOut()` from sidebar.
- (Your backend is responsible for creating the `auth.users` row keyed by phone and returning a valid session. I'll document the contract in the code.)

## Database (Lovable Cloud migration)

- `app_role` enum: `admin | user`
- `user_roles(user_id, role)` + `has_role()` security-definer fn (privilege-safe pattern)
- `profiles`: `id (=auth.users.id)`, `phone`, `is_suspended`, `created_at`
- `sessions`: `id`, `user_id`, `session_string` (text, treated as sensitive), `created_at`, `last_active`
- `rules`: `id`, `user_id`, `rule_name`, `source_chat`, `target_chat`, `options jsonb`, `is_enabled`, `status` (`active|paused|error`), `created_at`
- `logs`: `id`, `rule_id`, `user_id`, `source`, `target`, `message_type`, `status`, `error_reason`, `created_at`
- `announcements`: `id`, `message`, `created_at`, `created_by`
- RLS: users see only their own rows; admins see all via `has_role(auth.uid(),'admin')`. Grants for `authenticated` + `service_role`.

## Routes

- `/auth` — phone + OTP screens (public)
- `/_authenticated/` layout — gated subtree
  - `/` Dashboard — stat cards (rules count, active, logs today, worker status)
  - `/rules` — table + Create/Edit drawer with all the fields you listed
  - `/logs` — table with rule/date/status filters + pagination
  - `/settings` — theme toggle, phone display, session info, sign out
  - `/admin` — gated by `has_role admin`: users table w/ suspend, active sessions, broadcast form, system logs, worker status card

## Rule drawer fields

Name, source_chat, target_chat, checkboxes (copy mode, preserve formatting/media/caption), dynamic find→replace pairs, prefix, suffix, include keywords (csv), exclude keywords (csv), delay seconds, enabled toggle. Stored in `options jsonb` except the top-level columns.

## UI / design system

- Dark-by-default professional SaaS theme via `src/styles.css` tokens (oklch). Light mode toggle in navbar/settings (class-based `.dark` variant already wired).
- shadcn Sidebar (`Dashboard / Rules / Logs / Settings / Admin*`), top navbar with phone + avatar + logout.
- Status badges (green=active, amber=paused, red=error), empty states, sonner toasts for all async calls, skeleton loading.
- Responsive: sidebar collapses to icon strip on mobile.

## Backend integration

- `NEXT_PUBLIC_BACKEND_URL` env var (I'll also accept `VITE_BACKEND_URL` for the browser since Vite only exposes `VITE_*`; documented in README).
- Thin `src/lib/backend.ts` client with `sendOtp`, `verifyOtp`, `getWorkerStatus`, `broadcast`.
- Worker status card polls `/worker/status` every 30s.

## Out of scope (call out)

- Actual Telegram MTProto forwarding logic — that's your Python worker.
- Sending the broadcast to Telegram — frontend posts to your backend; backend fan-out.
- Encrypting `session_string` at rest — recommended to do server-side in your Python worker before insert; I'll store as-is in a column with RLS lockdown (only owner + service role).

## Deliverables this turn

1. Enable Lovable Cloud and run the schema migration.
2. Design system + dark theme tokens.
3. Auth pages + Supabase session wiring.
4. Authenticated layout, sidebar, navbar, theme toggle.
5. Dashboard, Rules (with drawer), Logs, Settings, Admin pages.
6. Backend client + worker status polling.
