import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ListChecks, ScrollText, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { backend, isBackendConfigured } from "@/lib/backend";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [rules, active, logsToday] = await Promise.all([
        supabase.from("rules").select("id", { count: "exact", head: true }),
        supabase.from("rules").select("id", { count: "exact", head: true }).eq("is_enabled", true),
        supabase
          .from("logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
      ]);
      return {
        total: rules.count ?? 0,
        active: active.count ?? 0,
        logsToday: logsToday.count ?? 0,
      };
    },
  });

  const [worker, setWorker] = useState<{ online: boolean } | null>(null);
  useEffect(() => {
    if (!isBackendConfigured()) return;
    setWorker({ online: true });
    let cancelled = false;
    const tick = () => {
      backend
        .workerStatus.()
        .then((s) => !cancelled && setWorker({ online: s.online }))
        .catch(() => !cancelled && setWorker({ online: false }));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your forwarding rules and worker.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total rules" value={stats?.total ?? "—"} icon={ListChecks} />
        <StatCard title="Active rules" value={stats?.active ?? "—"} icon={Activity} />
        <StatCard title="Events (24h)" value={stats?.logsToday ?? "—"} icon={ScrollText} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Worker</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <StatusBadge status={worker?.online ? "active" : worker === null ? "paused" : "error"} />
              <span className="text-sm text-muted-foreground">
                {worker === null ? "Checking…" : worker.online ? "Online" : "Offline"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Create a forwarding rule pointing from a source chat to a target chat.</p>
          <p>2. Configure replacements, filters, prefix/suffix, and delay.</p>
          <p>3. Toggle the rule on — the worker will start forwarding messages.</p>
        </CardContent>
      </Card>
    </div>
  );
}
