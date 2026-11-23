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
}

export interface ReplicaState {
  step: 0 | 1 | 2 | 3;
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
}

export type ReplicaPatch = Partial<Omit<ReplicaState, 'add'>> & {
  add?: Partial<ReplicaAdd>;
};

export interface Replica {
  state: ReplicaState;
  counters: { clicks: Record<string, number>; untrusted: number };
  set(patch: ReplicaPatch): void;
  toast(
    kind: 'alreadyListed' | 'clash' | 'refused' | 'submitted',
    subjectId: string,
  ): void;
  interactions(): number;
}

export function initialState(): ReplicaState;
export function mountReplica(doc: Document, overrides?: ReplicaPatch): Replica;
