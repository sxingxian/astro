"use client";

import { useEffect } from "react";
import { savePendingOffer } from "@/lib/invite-client";

/** Signed out on /offer: remember to come back here after signing in. */
export function RememberOffer() {
  useEffect(() => savePendingOffer(), []);
  return null;
}
