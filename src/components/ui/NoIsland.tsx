"use client";

import { Component, type ReactNode } from "react";

/** Shown instead of the 3D island when it can't run. Plain text, no link: it sits in the aria-hidden island wrapper. */
export function NoIsland() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <p className="max-w-sm rounded-xl border-[3px] border-ink bg-paper p-5 text-ink shadow-[0_6px_0_var(--color-ink)]">This browser can’t show the 3D town. Every project is in the list below.</p>
    </div>
  );
}

/**
 * If the 3D part fails (its code didn't download on a bad connection, no WebGL, or a crash), show
 * the message above instead of a loading screen that never goes away. The rest of the page keeps working.
 * This also covers a browser without WebGL: the 3D renderer throws when it can't get a WebGL context.
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
