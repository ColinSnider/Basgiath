import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useStore, type Goal, type Book } from "@/lib/basgiath-store";
import { useMemo, useState } from "react";
import { Trash2, Plus, Target as TargetIcon } from "lucide-react";

export const Route = createFileRoute("/goals")({ component: Goals });
const METRIC_LABEL: Record<Goal["metric"], string> = { books: "books", pages: "pages", minutes: "hours" };

function startOf(timeframe: Goal["timeframe"]) { const now = new Date(); if (timeframe === "year") return new Date(now.getFullYear(), 0, 1); if (timeframe === "month") return new Date(now.getFullYear(), now.getMonth(), 1); const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }

function contribution(books: Book[], g: Goal) {
  const since = startOf(g.timeframe);
  return books.map((b) => {
    const finished = b.reads.filter((r) => new Date(r.finishedAt) >= since).length;
    if (g.metric === "books") return { b, value: finished };
    if (g.metric === "pages") return { b, value: finished * (b.totalPages ?? 0) };
    return { b, value: Math.round((finished * (b.durationMinutes ?? 0)) / 6) / 10 };
  }).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
}

function Goals() {
  const { goals, books, addGoal, removeGoal } = useStore();
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState<Goal["metric"]>("books");
  const [timeframe, setTimeframe] = useState<Goal["timeframe"]>("year");
  const [target, setTarget] = useState("12");
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const contributionMap = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, contribution(books, g)])), [books, goals]);
  function progressFor(g: Goal) { return contributionMap[g.id]?.reduce((s, x) => s + x.value, 0) ?? 0; }

  return <>
    <AppHeader title="Goals" subtitle="Set your own pace." />
    <section className="px-5 md:px-8 space-y-3">
      {goals.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No goals yet.</p> : goals.map((g) => {
        const prog = progressFor(g); const pct = Math.min(100, Math.round((prog / g.target) * 100));
        const open = expandedGoalId === g.id;
        return <div key={g.id} className="bg-card border border-border rounded-md p-4 relative">
          <button onClick={() => removeGoal(g.id)} className="absolute top-3 right-3 text-muted-foreground/60 hover:text-destructive" aria-label="Delete goal"><Trash2 className="h-4 w-4" /></button>
          <button onClick={() => setExpandedGoalId(open ? null : g.id)} className="block text-left w-full">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold font-semibold"><TargetIcon className="h-3.5 w-3.5" /><span>{g.timeframe}ly</span></div>
            <p className="font-display text-2xl mt-1.5">{prog} <span className="text-muted-foreground text-base">/ {g.target}</span> <span className="text-sm text-muted-foreground font-sans">{METRIC_LABEL[g.metric]}</span></p>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-gradient-to-r from-primary to-gold transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{pct}% there · {open ? "hide" : "show"} contributing books</p>
          </button>
          {open && <ul className="mt-3 space-y-2 border-t border-border pt-3">{contributionMap[g.id]?.map(({ b, value }) => <li key={b.id} className="text-sm flex justify-between"><span className="truncate pr-2">{b.title}</span><span className="text-muted-foreground">{value} {METRIC_LABEL[g.metric]}</span></li>)}</ul>}
        </div>;
      })}
    </section>
    <section className="px-5 md:px-8 mt-5">{!adding ? <button onClick={() => setAdding(true)} className="w-full inline-flex items-center justify-center gap-1.5 border border-dashed border-border text-sm py-3 rounded-md text-muted-foreground hover:text-foreground hover:border-primary/40"><Plus className="h-4 w-4" /> New goal</button> : <form onSubmit={(e) => { e.preventDefault(); const n = Number(target); if (!n || n < 1) return; addGoal({ metric, timeframe, target: n }); setAdding(false); setTarget("12"); }} className="bg-card border border-border rounded-md p-4 space-y-3"><div className="flex gap-1">{(["books","pages","minutes"] as const).map((m)=><button type="button" key={m} onClick={()=>setMetric(m)} className={`flex-1 text-xs py-1.5 rounded-sm capitalize ${metric===m?"bg-muted font-medium":"text-muted-foreground"}`}>{m==="minutes"?"hours":m}</button>)}</div><div className="flex gap-1">{(["week","month","year"] as const).map((t)=><button type="button" key={t} onClick={()=>setTimeframe(t)} className={`flex-1 text-xs py-1.5 rounded-sm capitalize ${timeframe===t?"bg-muted font-medium":"text-muted-foreground"}`}>{t}ly</button>)}</div><input value={target} onChange={(e)=>setTarget(e.target.value.replace(/\D/g,""))} className="w-full bg-muted rounded-md px-3 py-2 text-sm outline-none" /><div className="flex gap-2"><button type="button" onClick={()=>setAdding(false)} className="flex-1 text-sm py-2 rounded-md border border-border">Cancel</button><button type="submit" className="flex-1 text-sm py-2 rounded-md bg-primary text-primary-foreground">Create</button></div></form>}</section>
  </>;
}
