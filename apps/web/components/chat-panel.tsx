"use client";

import { useState } from "react";
import useSWRMutation from "swr/mutation";
import clsx from "clsx";

async function sendQuestion(url: string, { arg }: { arg: { prompt: string } }) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg)
  });
  if (!res.ok) {
    throw new Error("Failed to query 80HD");
  }
  return res.json() as Promise<{ answer: string }>;
}

export function ChatPanel() {
  const [prompt, setPrompt] = useState("");
  const { trigger, data, isMutating, error } = useSWRMutation("/api/query", sendQuestion);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Ask 80HD</h2>
          <p className="text-xs text-neutral-400">Natural language access to your day.</p>
        </div>
        <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-neutral-300">
          Alpha
        </span>
      </header>

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!prompt.trim()) return;
          await trigger({ prompt });
        }}
      >
        <textarea
          className="min-h-[120px] rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-neutral-200 outline-none focus:border-accent"
          placeholder="What did I promise the team this morning?"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="flex items-center justify-between text-xs text-neutral-400">
          {error ? <span className="text-rose-400">{error.message}</span> : <span />}
          <button
            type="submit"
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              isMutating
                ? "cursor-wait bg-white/5 text-neutral-400"
                : "bg-accent text-black hover:bg-accent-light"
            )}
            disabled={isMutating}
          >
            {isMutating ? "Thinking..." : "Generate summary"}
          </button>
        </div>
      </form>

      {data?.answer && (
        <article className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-200">
          <p className="whitespace-pre-wrap">{data.answer}</p>
        </article>
      )}
    </section>
  );
}


