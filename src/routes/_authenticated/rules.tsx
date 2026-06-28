import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ListChecks, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

export const Route = createFileRoute("/_authenticated/rules")({
  component: RulesPage,
});

interface RuleOptions {
  copy_mode: boolean;
  preserve_formatting: boolean;
  preserve_media: boolean;
  preserve_caption: boolean;
  replacements: { find: string; replace: string }[];
  prefix: string;
  suffix: string;
  include_keywords: string;
  exclude_keywords: string;
  delay: number;
}

interface RuleRow {
  id: string;
  user_id: string;
  rule_name: string;
  source_chat: string;
  target_chat: string;
  options: RuleOptions;
  is_enabled: boolean;
  status: string;
  created_at: string;
}

const defaultOptions: RuleOptions = {
  copy_mode: true,
  preserve_formatting: true,
  preserve_media: true,
  preserve_caption: true,
  replacements: [],
  prefix: "",
  suffix: "",
  include_keywords: "",
  exclude_keywords: "",
  delay: 0,
};

interface RuleDraft {
  id?: string;
  rule_name: string;
  source_chat: string;
  target_chat: string;
  is_enabled: boolean;
  options: RuleOptions;
}

const emptyDraft: RuleDraft = {
  rule_name: "",
  source_chat: "",
  target_chat: "",
  is_enabled: true,
  options: defaultOptions,
};

function RulesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RuleRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rules"] });

  const upsertMutation = useMutation({
    mutationFn: async (d: RuleDraft) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        rule_name: d.rule_name,
        source_chat: d.source_chat,
        target_chat: d.target_chat,
        is_enabled: d.is_enabled,
        options: d.options as unknown as Record<string, unknown>,
        status: d.is_enabled ? "active" : "paused",
        user_id: u.user.id,
      };
      if (d.id) {
        const { error } = await supabase.from("rules").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(draft.id ? "Rule updated" : "Rule created");
      setOpen(false);
      setDraft(emptyDraft);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("rules")
        .update({ is_enabled: enabled, status: enabled ? "active" : "paused" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const openCreate = () => {
    setDraft(emptyDraft);
    setOpen(true);
  };
  const openEdit = (rule: RuleRow) => {
    setDraft({
      id: rule.id,
      rule_name: rule.rule_name,
      source_chat: rule.source_chat,
      target_chat: rule.target_chat,
      is_enabled: rule.is_enabled,
      options: { ...defaultOptions, ...(rule.options ?? {}) },
    });
    setOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forwarding rules</h1>
          <p className="text-sm text-muted-foreground">Define which chats forward to which targets.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create rule
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading rules…</div>
          ) : !rules || rules.length === 0 ? (
            <EmptyState
              icon={<ListChecks className="h-8 w-8" />}
              title="No rules yet"
              description="Create your first forwarding rule to start moving messages between chats."
              action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Create rule</Button>}
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Enabled</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.rule_name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.source_chat}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.target_chat}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      <Switch
                        checked={r.is_enabled}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, enabled: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete rule "${r.rule_name}"?`)) deleteMutation.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RuleDrawer
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        onSave={() => upsertMutation.mutate(draft)}
        saving={upsertMutation.isPending}
      />
    </div>
  );
}

function RuleDrawer({
  open,
  onOpenChange,
  draft,
  setDraft,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: RuleDraft;
  setDraft: (d: RuleDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const setOpts = (patch: Partial<RuleOptions>) =>
    setDraft({ ...draft, options: { ...draft.options, ...patch } });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{draft.id ? "Edit rule" : "Create rule"}</SheetTitle>
          <SheetDescription>Configure how messages are forwarded.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <div className="space-y-2">
            <Label>Rule name</Label>
            <Input
              value={draft.rule_name}
              onChange={(e) => setDraft({ ...draft, rule_name: e.target.value })}
              placeholder="News → Personal"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source chat</Label>
              <Input
                value={draft.source_chat}
                onChange={(e) => setDraft({ ...draft, source_chat: e.target.value })}
                placeholder="@channel or -100..."
              />
            </div>
            <div className="space-y-2">
              <Label>Target chat</Label>
              <Input
                value={draft.target_chat}
                onChange={(e) => setDraft({ ...draft, target_chat: e.target.value })}
                placeholder="@channel or -100..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Options</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["copy_mode", "Copy mode"],
                ["preserve_formatting", "Preserve formatting"],
                ["preserve_media", "Preserve media"],
                ["preserve_caption", "Preserve caption"],
              ] as const).map(([k, label]) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={draft.options[k]}
                    onCheckedChange={(v) => setOpts({ [k]: Boolean(v) } as Partial<RuleOptions>)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Text replacements</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOpts({ replacements: [...draft.options.replacements, { find: "", replace: "" }] })
                }
              >
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </div>
            {draft.options.replacements.length === 0 ? (
              <p className="text-xs text-muted-foreground">No replacements configured.</p>
            ) : (
              <div className="space-y-2">
                {draft.options.replacements.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="find"
                      value={pair.find}
                      onChange={(e) => {
                        const r = [...draft.options.replacements];
                        r[idx] = { ...r[idx], find: e.target.value };
                        setOpts({ replacements: r });
                      }}
                    />
                    <span className="text-muted-foreground">→</span>
                    <Input
                      placeholder="replace"
                      value={pair.replace}
                      onChange={(e) => {
                        const r = [...draft.options.replacements];
                        r[idx] = { ...r[idx], replace: e.target.value };
                        setOpts({ replacements: r });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOpts({
                          replacements: draft.options.replacements.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prefix</Label>
              <Input
                value={draft.options.prefix}
                onChange={(e) => setOpts({ prefix: e.target.value })}
                placeholder="📢 "
              />
            </div>
            <div className="space-y-2">
              <Label>Suffix</Label>
              <Input
                value={draft.options.suffix}
                onChange={(e) => setOpts({ suffix: e.target.value })}
                placeholder=" — forwarded"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Include keywords (comma separated)</Label>
            <Textarea
              rows={2}
              value={draft.options.include_keywords}
              onChange={(e) => setOpts({ include_keywords: e.target.value })}
              placeholder="urgent, breaking"
            />
          </div>
          <div className="space-y-2">
            <Label>Exclude keywords (comma separated)</Label>
            <Textarea
              rows={2}
              value={draft.options.exclude_keywords}
              onChange={(e) => setOpts({ exclude_keywords: e.target.value })}
              placeholder="ad, sponsor"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Delay (seconds)</Label>
              <Input
                type="number"
                min={0}
                value={draft.options.delay}
                onChange={(e) => setOpts({ delay: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex w-full cursor-pointer items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2 text-sm">
                <span>Enabled</span>
                <Switch
                  checked={draft.is_enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, is_enabled: v })}
                />
              </label>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving || !draft.rule_name || !draft.source_chat || !draft.target_chat}>
            {saving ? "Saving…" : draft.id ? "Save changes" : "Create rule"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
