"use client";

import { useState } from "react";
import { useLatestDigest, usePendingActionItems } from "../lib/queries/digests.js";

export function DigestCard() {
  const [activeTab, setActiveTab] = useState<"highlights" | "followUps">("highlights");
  const { data: digest, isLoading: digestLoading } = useLatestDigest();
  const { data: actionItems, isLoading: itemsLoading } = usePendingActionItems();

  return (
    <section className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Daily Digest</h2>
          <p className="text-xs text-neutral-400">
            {digest
              ? `Last updated: ${new Date(digest.date).toLocaleDateString()}`
              : "No digest available"}
            {actionItems && actionItems.length > 0 && ` · ${actionItems.length} action items`}
          </p>
        </div>
        {digest && (
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-neutral-300">
            Ready
          </div>
        )}
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
        {digestLoading || itemsLoading ? (
          <p className="text-neutral-400">Loading...</p>
        ) : activeTab === "highlights" ? (
          digest?.highlights && digest.highlights.length > 0 ? (
            digest.highlights.map((highlight, index) => (
              <article key={index} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs uppercase text-accent-light">Highlight</p>
                <p className="mt-1 text-neutral-300">{highlight}</p>
              </article>
            ))
          ) : (
            <p className="text-neutral-400">No highlights available</p>
          )
        ) : (
          actionItems && actionItems.length > 0 ? (
            actionItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="font-medium text-white">{item.content}</p>
                {item.due_date && (
                  <p className="text-xs text-emerald-200">
                    Due: {new Date(item.due_date).toLocaleDateString()}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p className="text-neutral-400">No pending action items</p>
          )
        )}
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


