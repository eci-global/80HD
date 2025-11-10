"use client";

import { useMemo } from "react";
import { FocusPagerPanel } from "../components/focus-pager-panel.js";
import { DigestCard } from "../components/digest-card.js";
import { SignalCard } from "../components/signal-card.js";
import { ChatPanel } from "../components/chat-panel.js";
import { useActivityStats } from "../lib/queries/activities.js";
import { usePendingEscalations } from "../lib/queries/escalations.js";

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useActivityStats();
  const { data: escalations = [] } = usePendingEscalations();

  const stats = useMemo(
    () => {
      if (!statsData) {
        return [
          { label: "Context switches avoided", value: "-", delta: "Loading..." },
          { label: "Critical escalations handled", value: "-", delta: "Loading..." },
          { label: "Focus blocks preserved", value: "-", delta: "Loading..." }
        ];
      }

      return [
        {
          label: "Context switches avoided",
          value: statsData.contextSwitchesAvoided,
          delta: "Today"
        },
        {
          label: "Critical escalations handled",
          value: statsData.criticalEscalationsHandled,
          delta: `${escalations.length} pending`
        },
        {
          label: "Focus blocks preserved",
          value: statsData.focusBlocksPreserved,
          delta: "Estimated"
        }
      ];
    },
    [statsData, escalations.length]
  );

  // Create signal cards from escalations
  const signals = useMemo(() => {
    return escalations.slice(0, 3).map((esc) => ({
      id: esc.id,
      label: esc.priority_score > 0.8 ? "Critical Escalation" : "Focus Pager",
      score: esc.priority_score,
      from: "Activity",
      summary: esc.reason.join(", "),
      channel: esc.priority_score > 0.9 ? ("sms" as const) : ("focus-pager" as const)
    }));
  }, [escalations]);

  return (
    <>
      <section className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-sm"
          >
            <p className="text-sm text-neutral-400">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
            <p className="text-xs text-emerald-300">{stat.delta}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <DigestCard />
        <FocusPagerPanel />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {signals.length > 0 ? (
          signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))
        ) : (
          <p className="text-neutral-400">No priority signals</p>
        )}
      </section>

      <ChatPanel />
    </>
  );
}

