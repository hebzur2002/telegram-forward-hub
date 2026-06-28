import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Cpu, Megaphone, Users, ScrollText } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { backend, isBackendConfigured } from "@/lib/backend";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("last_active", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: systemLogs } = useQuery({
    queryKey: ["admin-system-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_suspended: suspend })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [worker, setWorker] = useState<{ online: boolean; uptime?: number } | null>(null);
  useEffect(() => {
    if (!isBackendConfigured()) return;
    let cancelled = false;
    const tick = () => {
      backend
        .workerStatus()
        .then((s) => !cancelled && setWorker({ online: s.online, uptime: s.uptime_seconds }))
        .catch(() => !cancelled && setWorker({ online: false }));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const [broadcastMsg, setBroadcastMsg] = useState("");
  const broadcastMutation = useMutation({
    mutationFn: async (msg: string) => {
      // Record in DB for history
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("announcements").insert({ message: msg, created_by: u.user?.id ?? null });
      if (isBackendConfigured()) {
        await backend.broadcast(msg);
      }
    },
    onSuccess: () => {
      toast.success("Announcement sent");
      setBroadcastMsg("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Broadcast failed"),
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin panel</h1>
        <p className="text-sm text-muted-foreground">Manage users, broadcasts, and worker status.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!users || users.length === 0 ? (
              <EmptyState title="No users yet" className="m-4" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{u.id.slice(0, 8)}…</TableCell>
                      <TableCell>{u.phone ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.is_suspended ? "paused" : "active"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={u.is_suspended ? "outline" : "destructive"}
                          onClick={() => suspendMutation.mutate({ id: u.id, suspend: !u.is_suspended })}
                        >
                          {u.is_suspended ? "Reinstate" : "Suspend"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4" /> Worker status</CardTitle>
            <CardDescription>Background Python worker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={worker?.online ? "active" : worker === null ? "paused" : "error"} />
              <span className="text-sm text-muted-foreground">
                {worker === null ? "Checking…" : worker.online ? "Online" : "Offline"}
              </span>
            </div>
            {worker?.uptime ? (
              <p className="text-xs text-muted-foreground">
                Uptime: {Math.round(worker.uptime / 60)} min
              </p>
            ) : null}
            {!isBackendConfigured() && (
              <p className="text-xs text-amber-400">VITE_BACKEND_URL is not configured.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Broadcast announcement</CardTitle>
            <CardDescription>Send a message to all users via Telegram.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={4}
              placeholder="Write your announcement…"
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
            />
            <Button
              disabled={!broadcastMsg.trim() || broadcastMutation.isPending}
              onClick={() => broadcastMutation.mutate(broadcastMsg.trim())}
            >
              {broadcastMutation.isPending ? "Sending…" : "Send to all users"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4" /> Active sessions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!sessions || sessions.length === 0 ? (
              <EmptyState title="No active sessions" className="m-4" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{s.user_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{new Date(s.last_active).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System logs (latest 20)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!systemLogs || systemLogs.length === 0 ? (
            <EmptyState title="No log entries yet" className="m-4" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Source → Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemLogs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.source ?? "?"} → {row.target ?? "?"}
                    </TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">
                      {row.error_reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
