import { CalendarDays } from 'lucide-react';

// Floating launcher shown on every host route. During bootstrap it only proves
// the closed shadow root UI mounts and the Tailwind pipeline styles it. The
// overlay panel it opens is implemented in a later phase.
export function Launcher() {
  const handleClick = () => {
    // The overlay panel is not built yet.
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Open KMITL Course Planner"
      className="fixed right-5 bottom-5 z-[2147483647] inline-flex items-center gap-2 rounded-[var(--kcp-radius)] bg-[var(--kcp-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--kcp-shadow)] outline-none transition-colors hover:bg-[var(--kcp-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <CalendarDays size={18} strokeWidth={2} aria-hidden />
      <span>Planner</span>
    </button>
  );
}
