import { Launcher } from '@/features/shell/Launcher';

// Root component for the content script UI. The overlay panel is added in a
// later phase; for now the app renders only the floating launcher.
export function App() {
  return <Launcher />;
}
