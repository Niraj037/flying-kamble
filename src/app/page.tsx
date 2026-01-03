"use client";

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Canvas
const GameEngine = dynamic(() => import('@/components/Game/GameEngine'), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-0 overflow-hidden bg-black">
      <GameEngine />
    </main>
  );
}
