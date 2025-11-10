"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

interface PagerNotification {
  id: string;
  sender: string;
  message: string;
  receivedAt: string;
  acknowledged: boolean;
}

const seedNotifications: PagerNotification[] = [
  {
    id: "pager-1",
    sender: "Ops Bot",
    message: "Site reliability incident #234 resolved. Capture lessons learned.",
    receivedAt: "11:02 AM",
    acknowledged: false
  },
  {
    id: "pager-2",
    sender: "Sam (PM)",
    message: "Need quick sign-off on the launch blog intro.",
    receivedAt: "9:48 AM",
    acknowledged: true
  }
];

export default function FocusPagerPage() {
  const [notifications, setNotifications] = useState(seedNotifications);
  const ackCount = notifications.filter((n) => n.acknowledged).length;

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const toggleAcknowledged = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, acknowledged: !notification.acknowledged }
          : notification
      )
    );
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-black/60 p-6 text-neutral-100">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Focus Pager</h1>
          <p className="text-xs text-neutral-400">{ackCount}/{notifications.length} acknowledged</p>
        </div>
        <button className="rounded-full border border-white/20 px-3 py-1 text-xs text-neutral-300">
          Preferences
        </button>
      </header>

      <ul className="space-y-4">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={clsx(
              "rounded-2xl border p-4 shadow transition",
              notification.acknowledged
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10"
            )}
          >
            <div className="flex items-center justify-between text-xs uppercase">
              <span>{notification.sender}</span>
              <time>{notification.receivedAt}</time>
            </div>
            <p className="mt-2 text-sm">{notification.message}</p>
            <button
              type="button"
              onClick={() => toggleAcknowledged(notification.id)}
              className="mt-3 rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-wide text-neutral-200"
            >
              {notification.acknowledged ? "Mark unacked" : "Acknowledge"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


