import {
  useCallback,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import { QuarantineCard } from '@/features/plans/QuarantineCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PanelRecoveryCard } from '@/components/PanelRecoveryCard';
import { IS_DEBUG } from '@/lib/env';
import { PanelPortalContext } from './PanelPortalContext';
import { Header } from './Header';
import { SaveIndicator } from './SaveIndicator';
import { Layout } from './Layout';
import { ShortcutHelp } from './ShortcutHelp';
import { CrashProbe } from './CrashProbe';
import { useBottomNavShown } from './mobilePane';
import { useShellChrome } from './ShellChromeContext';
import { useTranslation } from './useTranslation';
import { usePanelShortcuts } from './usePanelShortcuts';

// The panel itself, shared by every root that shows it: the header, the save and
// quarantine notices, the body inside its error boundary, the keyboard shortcuts with
// their help, and the layers a root hosts above the body. It renders the panel's one
// main region. The node carries the panel language, because the host document's own
// lang does not follow the language choice, and the popovers portal into it so they
// inherit it. The portal context covers the header as well as the body, so a header
// control such as the plan switcher can open its bottom sheet over the whole panel.
// The body pads clear of the side insets and of the bottom one, except while the bottom
// nav runs along its foot: the nav pads itself there, so its fill reaches the screen
// edge under the home indicator.
//
// What makes the panel a modal layer over a host page, its dialog role, focus trap,
// scroll lock, and close paths, belongs to the root that wraps it, which passes those
// attributes and its own placement classes in and reads the node through the ref.

/** The node attributes a wrapping root gives the panel, such as a dialog role. */
export type PanelNodeAttributes = Pick<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'aria-modal' | 'aria-labelledby'
>;

interface PanelFrameProps {
  /** The id the header title carries, so a wrapping layer can be named by it. */
  titleId: string;
  /** Whether the panel takes its keys, false while it leaves. */
  active: boolean;
  /** Receives the panel node for the wrapping root's own behaviour. */
  nodeRef: RefObject<HTMLDivElement | null>;
  /** The wrapping root's placement and transition classes. */
  className: string;
  nodeAttributes?: PanelNodeAttributes;
  /** Layers that render above the panel body inside the panel node. */
  children?: ReactNode;
}

export function PanelFrame({
  titleId,
  active,
  nodeRef,
  className,
  nodeAttributes,
  children,
}: PanelFrameProps) {
  const { t, language } = useTranslation();
  const { errorBody } = useShellChrome();
  // Track the panel node in state as well, so the portal context updates once the node
  // mounts and floating-ui popups inside the transformed sheet can render into it.
  const [panelNode, setPanelNode] = useState<HTMLDivElement | null>(null);
  const attachPanel = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      setPanelNode(node);
    },
    [nodeRef],
  );
  const navShown = useBottomNavShown();
  const [helpOpen, setHelpOpen] = useState(false);
  // A panel that leaves takes the shortcut help with it, so a return starts without it.
  if (!active && helpOpen) setHelpOpen(false);
  const openHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);
  usePanelShortcuts(nodeRef, { enabled: active, onHelp: openHelp });

  return (
    <div
      ref={attachPanel}
      {...nodeAttributes}
      lang={language}
      tabIndex={-1}
      className={`${className} flex flex-col bg-surface text-ink outline-none`}
    >
      <PanelPortalContext.Provider value={panelNode}>
        <Header titleId={titleId} />
        <SaveIndicator />
        <QuarantineCard />
        {/* The boundary wraps the panel body, not the whole panel, so a render error
            in the search, catalog, or planner shows the recovery card while the
            header keeps its controls, the close control when the chrome gives one,
            and the sibling layers of the root stay alive. */}
        <ErrorBoundary
          fallback={(reset) => (
            <PanelRecoveryCard t={t} body={errorBody} onReload={reset} />
          )}
        >
          {IS_DEBUG ? <CrashProbe /> : null}
          <main
            className={`min-h-0 flex-1 overflow-hidden pr-(--kcp-safe-right) pl-(--kcp-safe-left) ${
              navShown ? '' : 'pb-(--kcp-safe-bottom)'
            }`}
          >
            <Layout />
          </main>
        </ErrorBoundary>
        {helpOpen ? (
          <ShortcutHelp
            onClose={() => {
              setHelpOpen(false);
            }}
          />
        ) : null}
        {children}
      </PanelPortalContext.Provider>
    </div>
  );
}
