"use client";

import { Component, type ReactNode } from "react";

/** Shown instead of the 3D island when it can't run. Plain text, no link: it sits in the aria-hidden island wrapper. */
export function NoIsland() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <p className="max-w-sm rounded-2xl bg-white/90 p-5 text-ink">This browser can’t show the 3D island. Every project is in the list below.</p>
    </div>
  );
}

/**
 * If the 3D part fails (its code didn't download on a bad connection, or WebGL crashed), show
 * the message above instead of a loading screen that never goes away. The rest of the page keeps working.
 */
export class IslandBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? <NoIsland /> : this.props.children;
  }
}
