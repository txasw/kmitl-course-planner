import { describe, it, expect, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from '@testing-library/react';
import {
  initialOnboardingData,
  onboardingStore,
} from '@/features/onboarding/onboardingStore';
import {
  useOnboardingPersistence,
  type OnboardingPersistenceDeps,
} from '@/features/onboarding/useOnboardingPersistence';
import { planStore } from '@/features/plans/planStore';
import { createInstallRepository } from '@/lib/storage/install';
import { createOnboardingRepository } from '@/lib/storage/onboarding';
import { makePlan } from '../../../tests/support/domain-builders';
import { createMemoryStorage } from '../../../tests/support/memoryStorage';
import { resetPlanStore } from '../../../tests/support/plan-store';
import { Launcher } from './Launcher';
import { uiStore } from './uiStore';

const RING = 'kcp-launcher-ring';

afterEach(() => {
  cleanup();
  act(() => {
    uiStore.getState().close();
    uiStore.getState().setLanguage('th');
    onboardingStore.setState(initialOnboardingData());
    resetPlanStore();
    planStore.setState({ loaded: false });
  });
});

/** Settles the plan read, the onboarding read and the welcome decision of a first visit. */
function settleFirstVisit(): void {
  act(() => {
    planStore.setState({ loaded: true });
    onboardingStore.getState().hydrate(null, { schemaVersion: 1 });
    onboardingStore.getState().settleWelcome();
  });
}

interface LauncherWithPersistenceProps {
  deps: OnboardingPersistenceDeps;
}

// The launcher with the persistence hook that records the first panel open, over
// storage that holds no onboarding record yet.
function LauncherWithPersistence({ deps }: LauncherWithPersistenceProps) {
  useOnboardingPersistence(deps);
  return <Launcher />;
}

describe('Launcher', () => {
  it('renders an accessible launcher button in the default locale', () => {
    render(<Launcher />);
    const button = screen.getByRole('button', {
      name: 'เปิด KCP: Course Planner for KMITL',
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Planner');
  });

  it('opens the overlay when activated', () => {
    render(<Launcher />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'เปิด KCP: Course Planner for KMITL',
      }),
    );
    expect(uiStore.getState().isOpen).toBe(true);
  });

  it('localizes the label when the language is English', () => {
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    render(<Launcher />);
    expect(
      screen.getByRole('button', {
        name: 'Open KCP: Course Planner for KMITL',
      }),
    ).toBeInTheDocument();
  });

  it('carries the active language for its label', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('lang', 'th');
    act(() => {
      uiStore.getState().setLanguage('en');
    });
    expect(button).toHaveAttribute('lang', 'en');
  });

  it('keeps its corner offset or the device safe area inset, whichever is larger', () => {
    render(<Launcher />);
    expect(screen.getByRole('button')).toHaveClass(
      'right-[max(20px,var(--kcp-safe-right))]',
      'bottom-[max(20px,var(--kcp-safe-bottom))]',
    );
  });

  it('is a full pill at least 48 px tall that lifts only without reduced motion', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass(
      'rounded-full',
      'bg-primary-strong',
      'min-h-12',
      'px-5',
      'motion-safe:hover:-translate-y-0.5',
      'motion-safe:focus-visible:-translate-y-0.5',
    );
    // The lift moves the pill only; the shadow stays at its one level.
    expect(button.className).not.toMatch(/hover:shadow|focus-visible:shadow/);
  });

  it('is interactive while neither the panel nor the welcome is open', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('inert');
    expect(button).not.toHaveAttribute('aria-hidden');
  });

  it('is inert and hidden while the panel is open', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    act(() => {
      uiStore.getState().open();
    });
    expect(button).toHaveAttribute('inert');
    expect(button).toHaveAttribute('aria-hidden', 'true');
  });

  it('is inert and hidden while the welcome is open, and interactive again after it closes', () => {
    render(<Launcher />);
    const button = screen.getByRole('button');
    act(() => {
      onboardingStore.getState().setWelcomeOpen(true);
    });
    expect(button).toHaveAttribute('inert');
    expect(button).toHaveAttribute('aria-hidden', 'true');
    act(() => {
      onboardingStore.getState().setWelcomeOpen(false);
    });
    expect(button).not.toHaveAttribute('inert');
    expect(button).not.toHaveAttribute('aria-hidden');
  });

  describe('attention ring', () => {
    it('carries no ring before the reads and the welcome decision settle', () => {
      render(<Launcher />);
      const button = screen.getByRole('button');
      act(() => {
        planStore.setState({ loaded: true });
        onboardingStore.getState().hydrate(null, { schemaVersion: 1 });
      });
      expect(button).not.toHaveClass(RING);
      act(() => {
        onboardingStore.getState().settleWelcome();
      });
      expect(button).toHaveClass(RING);
    });

    it('carries no ring for a student with stored plans', () => {
      render(<Launcher />);
      act(() => {
        planStore.getState().hydrate([makePlan()]);
      });
      settleFirstVisit();
      expect(screen.getByRole('button')).not.toHaveClass(RING);
    });

    it('holds the ring while the welcome is open and starts it once the welcome closes', () => {
      render(<Launcher />);
      const button = screen.getByRole('button');
      act(() => {
        onboardingStore.getState().setWelcomeOpen(true);
      });
      settleFirstVisit();
      expect(button).not.toHaveClass(RING);
      act(() => {
        onboardingStore.getState().setWelcomeOpen(false);
      });
      expect(button).toHaveClass(RING);
    });

    it('drops the ring after the first open in the same document and keeps it off', async () => {
      const storage = createMemoryStorage();
      const deps = {
        install: createInstallRepository(storage),
        record: createOnboardingRepository(storage),
      };
      render(<LauncherWithPersistence deps={deps} />);
      await waitFor(() => {
        expect(onboardingStore.getState().loaded).toBe(true);
      });
      act(() => {
        planStore.setState({ loaded: true });
        onboardingStore.getState().settleWelcome();
      });
      const button = screen.getByRole('button', {
        name: 'เปิด KCP: Course Planner for KMITL',
      });
      expect(button).toHaveClass(RING);
      fireEvent.click(button);
      expect(button).not.toHaveClass(RING);
      act(() => {
        uiStore.getState().close();
      });
      expect(button).not.toHaveClass(RING);
      expect(button).toHaveAccessibleName('เปิด KCP: Course Planner for KMITL');
    });

    it('keeps the ring off a document whose stored record shows a first open', () => {
      render(<Launcher />);
      act(() => {
        planStore.setState({ loaded: true });
        onboardingStore.getState().hydrate(null, {
          schemaVersion: 1,
          panelFirstOpenedAt: '2026-11-06T08:00:00.000Z',
        });
        onboardingStore.getState().settleWelcome();
      });
      expect(screen.getByRole('button')).not.toHaveClass(RING);
    });
  });
});
