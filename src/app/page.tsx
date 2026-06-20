"use client";

import dynamic from "next/dynamic";

// Three.js needs the browser; load the game client-only.
const Game = dynamic(() => import("@/game/components/Game"), { ssr: false });

export default function Home() {
  return <Game />;
}
