import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { backend } from "@/lib/backend";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export const Route = createFileRoute("/_authenticated/logs")({
  component: LogsPage,
});

const PAGE_SIZE = 25;

function LogsPage() {
  const [page, setPage] = useState(1);
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: rulesData } = useQuery({
    queryKey: ["rules"],
    queryFn: () => backend.listRules(),
  });

  const ruleNames = useMemo(() => {
    const m = new Map<number, string>();
    rulesData?.rules.forEach((r) => m.set(r.id, r.rule_name));
    return m;
  }, [rulesData]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["logs", { page, ruleFilter, statusFilter }],
    queryFn: () =>
      backend.listLogs({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        rule_id: ruleFilter === "all" ? undefined : Number(ruleFilter),
      }),
  });

  const rows = data?.logs ?? [];
  const hasNext = rows.length === PAGE_SIZE;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">Forwarding activity across all rules.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Rule</Label>
            <Select value={ruleFilter} onValueChange={(v) => { setRuleFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rules</SelectItem>
                {rulesData?.rules.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.rule_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading logs…</div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load logs"}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-8 w-8" />}
              title="No log entries"
              description="When the worker forwards messages, you'll see them here."
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Source → Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.rule_id ? ruleNames.get(row.rule_id) ?? `#${row.rule_id}` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.source ?? "?"} <span className="text-foreground">→</span> {row.target ?? "?"}
                    </TableCell>
                    <TableCell className="text-xs">{row.message_type ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={row.status ?? ""} /></TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {row.error_reason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">Page {page}</div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
