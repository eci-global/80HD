"use client";

import { useState } from "react";

const mockDigest = {
  highlights: [
    {
      id: "hl-1",
      sender: "CEO",
      excerpt: "Please prepare Q4 hiring plan by Friday.",
      status: "Requires response"
    },
    {
      id: "hl-2",
      sender: "Finance",
      excerpt: "Budget review meeting moved to next Tuesday.",
      status: "FYI"
    }
  ],
  followUps: [
    {
      id: "fu-1",
      summary: "Reply to design feedback thread.",
      due: "Today 4:00 PM"
    },
    {
      id: "fu-2",
      summary: "Confirm agenda for partner sync.",
      due: "Tomorrow 9:00 AM"
    }
  ]
};

export function DigestCard() {
  const [activeTab, setActiveTab] = useState<"highlights" | "followUps">("highlights");

  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Daily Digest Preview</h2>
          <p className="text-xs text-neutral-400">Tonight at 6:00 PM · 12 items queued</p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-neutral-300">
          Draft ready
        </div>
      </div>

      <div className="mt-4 flex gap-3 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("highlights")}
          className={`rounded-full px-4 py-1 ${
            activeTab === "highlights"
              ? "bg-accent text-black"
              : "border border-white/20 text-neutral-300"
          }`}
        >
          Highlights
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("followUps")}
          className={`rounded-full px-4 py-1 ${
            activeTab === "followUps"
              ? "bg-accent text-black"
              : "border border-white/20 text-neutral-300"
          }`}
        >
          Follow-ups
        </button>
      </div>

      <div className="mt-4 space-y-3 text-sm text-neutral-200">
        {activeTab === "highlights"
          ? mockDigest.highlights.map((item) => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase text-accent-light">{item.status}</p>
                <p className="mt-1 font-medium text-white">{item.sender}</p>
                <p className="mt-1 text-neutral-300">{item.excerpt}</p>
              </article>
            ))
          : mockDigest.followUps.map((item) => (
              <article key={item.id} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="font-medium text-white">{item.summary}</p>
                <p className="text-xs text-emerald-200">{item.due}</p>
              </article>
            ))}
      </div>

      <button
        type="button"
        className="mt-5 rounded-full bg-white/10 px-4 py-2 text-sm text-neutral-200 hover:bg-white/15"
      >
        View full digest draft
      </button>
    </section>
  );
}


