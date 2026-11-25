"use client";

import dynamic from "next/dynamic";

export const LazyStarfield = dynamic(() => import("./Starfield"), { ssr: false });
