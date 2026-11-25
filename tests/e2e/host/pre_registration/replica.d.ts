// Types for the plain JavaScript replica, so the unit tests and the specs drive it typed.

export type Kind = 'ท' | 'ป';

export interface ReplicaRow {
  subjectId: string;
  section: string;
  kind: Kind;
  curriculum?: string | null;
  credit?: number;
  name?: string;
}

export interface ReplicaResult {
  subjectId: string;
  section: string;
  kind: Kind;
  curriculum?: string | null;
  grade: '' | 'Y' | 'N';
  condition?: boolean;
}

export interface ReplicaAdd {
  value: string;
  loading: boolean;
  sections:
    { section: string; kind: Kind; curriculum?: string | null }[] | null;
  selected: string | null;
  practice: { locked: boolean; section: string | null } | null;
  colour: 'pending' | 'fits' | 'clash';
  seats: { limit: number; count: number } | null;
}

/** The pre registration period, as the period check reports it. */
export type Period = 'before' | 'open' | 'closed';

export interface ReplicaState {
  step: 0 | 1 | 2 | 3;
  /** On the route of app.a1e43722, whether the panel shows: only while open. */
  period: Period;
  term: { semester: string; year: string };
  list: ReplicaRow[];
  add: ReplicaAdd;
  credits: { min: number | null; max: number | null };
  dialog:
    | { kind: 'grade'; subjectId: string; prerequisites: string[] }
    | { kind: 'confirm' }
    | { kind: 'timeSlot'; subjectId: string }
    | null;
  toasts: { kind: string; text: string }[];
  results: ReplicaResult[] | null;
  resultsLoading: boolean;
  menu: 'primary' | 'practice' | null;
}

/** One section the fake eligibility read returns for a subject. */
export interface CatalogSection {
  section: string;
  kind: Kind;
  curriculum?: string | null;
  /** The practice code a lecture is locked to, as the host's sec_pair. */
  pair?: string | null;
  limit?: number;
  count?: number;
}

export interface CatalogSubject {
  sections: CatalogSection[];
  credit?: number;
  /** Ids the grade not announced dialog names, when the read raises it. */
  prerequisites?: string[];
  refused?: boolean;
  /** Whether a full selection colours the add row as a clash. */
  clash?: boolean;
  /** Whether the read never answers. */
  hang?: boolean;
}

export type Variant =
  | 'continueAsAdd'
  | 'swapped'
  | 'confirmAsGrade'
  | 'gradeConfirmButton'
  | 'focusContinue'
  | 'enterSubmits'
  | 'labelledOption'
  | 'formAdd';

export interface ReplicaConfig {
  catalog?: Record<string, CatalogSubject>;
  delay?: number;
  variant?: Variant | null;
  xhr?: boolean;
  /** The period the next period check answers, which then applies it once. */
  answer?: Period | null;
  /**
   * Count each eligibility read and period check when its response ends, as the fill
   * tripwire's resource entries arrive, rather than when it starts.
   */
  countAtEnd?: boolean;
  /** How long a period check that sends no real request takes to answer, in ms. */
  pollLatency?: number;
}

/** The host builds whose route the replica renders around the panel. */
export type RouteBuild = 'a1e43722';

export interface RouteOptions {
  /** Render this build's route around the panel, with its periods and its period check. */
  route?: RouteBuild | null;
  /** How often the period check runs, in milliseconds, or 0 for only on focus. */
  poll?: number;
  /** How long the page shows an empty main area before its first render, in ms. */
  loading?: number;
}

export type ReplicaPatch = Partial<Omit<ReplicaState, 'add'>> & {
  add?: Partial<ReplicaAdd>;
};

export interface Replica {
  state: ReplicaState;
  counters: {
    clicks: Record<string, number>;
    untrusted: number;
    untrustedOn: Record<string, number>;
    writes: number;
    reads: number;
    /** The period checks the route ran. */
    polls: number;
  };
  configure(options: ReplicaConfig): void;
  forbidden(): number;
  pick(which: 'primary' | 'practice', index: number): void;
  set(patch: ReplicaPatch): void;
  toast(
    kind: 'alreadyListed' | 'clash' | 'refused' | 'submitted',
    subjectId: string,
  ): void;
  interactions(): number;
  /** Run one period check now, as the build's timer, a focus, or a visibility change does. */
  poll(): void;
  /** Advance the countdown by one second. */
  tick(): void;
  /** Stop the countdown, the period checks, and every later render. */
  destroy(): void;
}

export const ROUTE_BUILDS: readonly RouteBuild[];

export function initialState(): ReplicaState;
export function mountReplica(
  doc: Document,
  overrides?: ReplicaPatch,
  options?: RouteOptions,
): Replica;
