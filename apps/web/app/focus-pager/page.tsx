"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { usePendingEscalations, acknowledgeEscalation, dismissEscalation } from "../lib/queries/escalations.js";
import { requestNotificationPermission } from "../lib/notifications.js";

export default function FocusPagerPage() {
  const { data: escalations = [], isLoading, mutate } = usePendingEscalations();
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  const acknowledgedEscalations = escalations.filter((e) => e.status === 'acknowledged');
  const ackCount = acknowledgedEscalations.length;

  useEffect(() => {
    // Register service worker and request notification permission
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });

      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        requestNotificationPermission()
          .then((subscription) => {
            if (subscription) {
              setNotificationEnabled(true);
            }
          })
          .catch((error) => {
            console.error('Failed to enable notifications:', error);
          });
      } else if (Notification.permission === 'granted') {
        setNotificationEnabled(true);
      }
    }
  }, []);

  const handleAcknowledge = async (escalationId: string) => {
    try {
      await acknowledgeEscalation(escalationId);
      await mutate();
    } catch (error) {
      console.error("Failed to acknowledge escalation:", error);
    }
  };

  const handleDismiss = async (escalationId: string) => {
    try {
      await dismissEscalation(escalationId);
      await mutate();
    } catch (error) {
      console.error("Failed to dismiss escalation:", error);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-black/60 p-6 text-neutral-100">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Focus Pager</h1>
          <p className="text-xs text-neutral-400">
            {isLoading ? "Loading..." : `${ackCount}/${escalations.length} acknowledged`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notificationEnabled ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
              Notifications ON
            </span>
          ) : (
            <button
              onClick={async () => {
                const subscription = await requestNotificationPermission();
                if (subscription) {
                  setNotificationEnabled(true);
                }
              }}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-neutral-300 hover:bg-white/10"
            >
              Enable Notifications
            </button>
          )}
        </div>
      </header>

      {isLoading ? (
        <p className="text-neutral-400">Loading escalations...</p>
      ) : escalations.length === 0 ? (
        <p className="text-neutral-400">No pending escalations. You're all caught up!</p>
      ) : (
        <ul className="space-y-4">
          {escalations.map((escalation) => (
            <li
              key={escalation.id}
              className={clsx(
                "rounded-2xl border p-4 shadow transition",
                escalation.status === 'acknowledged'
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-rose-500/40 bg-rose-500/10"
              )}
            >
              <div className="flex items-center justify-between text-xs uppercase">
                <span>Escalation</span>
                <time>
                  {new Date(escalation.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p className="mt-2 text-sm">
                Priority: {Math.round(escalation.priority_score * 100)}% - {escalation.reason.join(", ")}
              </p>
              <div className="mt-3 flex gap-2">
                {escalation.status !== 'acknowledged' && (
                  <button
                    type="button"
                    onClick={() => handleAcknowledge(escalation.id)}
                    className="rounded-full bg-emerald-500/20 px-4 py-2 text-xs uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/30"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(escalation.id)}
                  className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-wide text-neutral-200 hover:bg-white/15"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


