"use client";

import { useEffect, useState } from "react";
import { useT } from "../CopyProvider";
import { localGreeting, type DayPart } from "@/lib/greeting";

/**
 * "Friday · 27 November" and "Good morning." (mockups D1 and phone Today; Astro doesn't ask for names, so none is shown). Members' days follow their account's
 * time zone; guests' follow the browser, worked out after the page loads.
 */
export function Greeting({ timeZone, initial }: { timeZone: string | null; initial: { part: DayPart; day: string } }) {
  const t = useT();
  const [now, setNow] = useState(initial);
  useEffect(() => setNow(localGreeting(timeZone)), [timeZone]);
  const greeting = t(`app.today.greet_${now.part}`);
  return (
    <div className="flex flex-col gap-2">
      <p className="eyebrow">{now.day}</p>
      <h1 className="m-0 font-display text-[40px] font-medium leading-tight lg:text-6xl">
        {t("app.today.greeting", { greeting })}
      </h1>
    </div>
  );
}

