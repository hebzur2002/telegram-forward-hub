import { createFileRoute, redirect } from "@tanstack/react-router";

// Root '/' redirects to the dashboard inside the authenticated layout.
// The _authenticated layout will bounce unauthenticated users to /auth.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
