"use client";

import { useMemo } from "react";
import { FocusPagerPanel } from "../components/focus-pager-panel.js";
import { DigestCard } from "../components/digest-card.js";
import { SignalCard } from "../components/signal-card.js";
import { ChatPanel } from "../components/chat-panel.js";

const mockSignals = [
  {
    id: "sig-1",
    label: "Critical Escalation",
    score: 0.91,
    from: "Engineering Leadership",
    summary: "Prod deployment blocked — waiting on your approval.",
    channel: "sms"
  },
  {
    id: "sig-2",
    label: "Focus Pager",
    score: 0.63,
    from: "Design Review",
    summary: "Figma comments ready, respond before 4pm.",
    channel: "focus-pager"
  },
  {
    id: "sig-3",
    label: "Digest",
    score: 0.18,
    from: "Random Slack DMs",
    summary: "8 conversations deferred to daily digest.",
    channel: "digest"
  }
];

export default function DashboardPage() {
  const stats = useMemo(
    () => [
      { label: "Context switches avoided", value: 17, delta: "+5 vs. yesterday" },
      { label: "Critical escalations handled", value: 2, delta: "100% acknowledged" },
      { label: "Focus blocks preserved", value: "3h 45m", delta: "Up 25%" }
    ],
    []
  );

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
        {mockSignals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </section>

      <ChatPanel />
    </>
  );
}

