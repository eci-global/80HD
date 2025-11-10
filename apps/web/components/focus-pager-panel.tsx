"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { usePendingEscalations, acknowledgeEscalation, dismissEscalation } from "../lib/queries/escalations.js";

export function FocusPagerPanel() {
  const { data: escalations = [], isLoading, mutate } = usePendingEscalations();
  const [selected, setSelected] = useState<string | null>(escalations[0]?.id ?? null);

  // Update selected when escalations change
  useEffect(() => {
    if (escalations.length > 0 && !selected) {
      setSelected(escalations[0].id);
    }
  }, [escalations, selected]);

  const selectedEscalation = escalations.find((e) => e.id === selected);

  const handleAcknowledge = async () => {
    if (!selected) return;
    try {
      await acknowledgeEscalation(selected);
      await mutate(); // Refresh the list
    } catch (error) {
      console.error("Failed to acknowledge escalation:", error);
    }
  };

  const handleDismiss = async () => {
    if (!selected) return;
    try {
      await dismissEscalation(selected);
      await mutate(); // Refresh the list
      // Select next escalation if available
      const remaining = escalations.filter((e) => e.id !== selected);
      setSelected(remaining[0]?.id ?? null);
    } catch (error) {
      console.error("Failed to dismiss escalation:", error);
    }
  };

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
        {isLoading ? (
          <p className="text-neutral-400">Loading escalations...</p>
        ) : escalations.length === 0 ? (
          <p className="text-neutral-400">No pending escalations</p>
        ) : (
          <>
            <ul className="flex w-48 flex-col gap-2">
              {escalations.map((item) => (
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
                    <p className="font-medium">Escalation</p>
                    <p className="text-xs text-neutral-400">
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-accent-light">
                      {Math.round(item.priority_score * 100)}% priority
                    </p>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex-1 rounded-xl border border-white/10 bg-black/30 p-4">
              {selectedEscalation ? (
                <article>
                  <h3 className="text-lg font-semibold text-white">
                    Priority Escalation
                  </h3>
                  <p className="mt-2 text-sm text-neutral-300">
                    80HD flagged this activity as urgent. Reasons: {selectedEscalation.reason.join(", ")}
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-xs text-neutral-400">
                    <span className="rounded-full bg-accent/20 px-3 py-1 text-accent-light">
                      FOCUS PAGER
                    </span>
                    <span>
                      Escalated at{" "}
                      {new Date(selectedEscalation.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={handleAcknowledge}
                      className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent/90"
                    >
                      Ack &amp; respond
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-300 hover:bg-white/10"
                    >
                      Mark as noise
                    </button>
                  </div>
                </article>
              ) : (
                <p className="text-neutral-400">Select an escalation to view details</p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}


