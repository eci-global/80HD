"use client";

import { useState } from "react";
import clsx from "clsx";

const mockEscalations = [
  {
    id: "esc-1",
    time: "11:15 AM",
    sender: "Sam (PM)",
    summary: "Need approval on launch email copy.",
    channel: "focus-pager"
  },
  {
    id: "esc-2",
    time: "9:42 AM",
    sender: "Ops Bot",
    summary: "Incident #234 resolved, acknowledgement required.",
    channel: "focus-pager"
  }
];

export function FocusPagerPanel() {
  const [selected, setSelected] = useState(mockEscalations[0]?.id);

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Focus Pager</h2>
          <p className="text-xs text-neutral-400">
            Urgent signals that bypass Slack, Teams, and Outlook.
          </p>
        </div>
        <button className="rounded-full border border-accent-light/40 bg-accent/10 px-4 py-1 text-xs uppercase tracking-wide text-accent-light shadow">
          Pause 25 min
        </button>
      </header>

      <div className="flex flex-1 gap-4">
        <ul className="flex w-48 flex-col gap-2">
          {mockEscalations.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item.id)}
                className={clsx(
                  "w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm transition",
                  selected === item.id
                    ? "border-accent/50 bg-accent/20 text-white"
                    : "bg-white/5 text-neutral-300 hover:bg-white/10"
                )}
              >
                <p className="font-medium">{item.sender}</p>
                <p className="text-xs text-neutral-400">{item.time}</p>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex-1 rounded-xl border border-white/10 bg-black/30 p-4">
          {mockEscalations
            .filter((item) => item.id === selected)
            .map((item) => (
              <article key={item.id}>
                <h3 className="text-lg font-semibold text-white">{item.summary}</h3>
                <p className="mt-2 text-sm text-neutral-300">
                  80HD flagged this message as urgent. Reply inside the Focus Pager or open the
                  original conversation if you need more context.
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="rounded-full bg-accent/20 px-3 py-1 text-accent-light">
                    {item.channel.toUpperCase()}
                  </span>
                  <span>Escalated at {item.time}</span>
                </div>
                <div className="mt-6 flex gap-3">
                  <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-black">
                    Ack &amp; respond
                  </button>
                  <button className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-300">
                    Mark as noise
                  </button>
                </div>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}


