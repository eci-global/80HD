"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

interface Signal {
  id: string;
  label: string;
  score: number;
  from: string;
  summary: string;
  channel: "sms" | "focus-pager" | "digest";
}

const channelCopy: Record<Signal["channel"], string> = {
  sms: "SMS Failsafe",
  "focus-pager": "Focus Pager",
  digest: "Daily Digest"
};

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center justify-between text-xs uppercase text-neutral-400">
        <span>{signal.label}</span>
        <span>{channelCopy[signal.channel]}</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white">{signal.from}</h3>
      <p className="mt-2 text-sm text-neutral-300">{signal.summary}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.span
            className={clsx("absolute inset-y-0 rounded-full", {
              "bg-rose-500": signal.channel === "sms",
              "bg-accent": signal.channel === "focus-pager",
              "bg-sky-300": signal.channel === "digest"
            })}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(signal.score * 100)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <span className="text-sm text-neutral-200">{Math.round(signal.score * 100)}%</span>
      </div>
    </motion.article>
  );
}


