// Payload mutation presets that simulate live contract deviations. The
// diagnostics simulator applies these to real responses in the browser, and the
// unit tests import the same functions, so whatever can be simulated manually is
// exactly what the automated suite covers. Each preset mutates the first section
// row of a cloned response, producing a single, targeted deviation.
//
// This module ships only in debug builds and tests, and embeds a canary the
// production bundle check greps for.

export const DEBUG_CANARY = 'kcp-debug-canary';

export interface MutationPreset {
  readonly id: string;
  readonly label: string;
  apply(response: unknown): unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Locate the first section row within a raw teach table response. */
function firstRowOf(response: unknown): Record<string, unknown> | null {
  if (!Array.isArray(response)) {
    return null;
  }
  for (const group of response) {
    if (!isRecord(group) || !Array.isArray(group.teachtable)) {
      continue;
    }
    for (const block of group.teachtable) {
      if (!isRecord(block) || !Array.isArray(block.data)) {
        continue;
      }
      for (const row of block.data) {
        if (isRecord(row)) {
          return row;
        }
      }
    }
  }
  return null;
}

/** Clone the response, apply a mutation to its first section row, and return it. */
function withFirstRow(
  response: unknown,
  mutate: (row: Record<string, unknown>) => void,
): unknown {
  const clone = structuredClone(response);
  const row = firstRowOf(clone);
  if (row !== null) {
    mutate(row);
  }
  return clone;
}

export const dropTeachTime2: MutationPreset = {
  id: 'drop_teach_time2',
  label: 'Drop teach_time2',
  apply: (response) =>
    withFirstRow(response, (row) => {
      delete row.teach_time2;
    }),
};

export const nullSubjectName: MutationPreset = {
  id: 'null_subject_name_th',
  label: 'Null subject_name_th',
  apply: (response) =>
    withFirstRow(response, (row) => {
      row.subject_name_th = null;
    }),
};

export const flipCountToNumber: MutationPreset = {
  id: 'flip_count_to_number',
  label: 'Flip count to a number',
  apply: (response) =>
    withFirstRow(response, (row) => {
      row.count = 0;
    }),
};

export const stripTeacherHtml: MutationPreset = {
  id: 'strip_teacher_html',
  label: 'Strip teacher_list_th HTML',
  apply: (response) =>
    withFirstRow(response, (row) => {
      row.teacher_list_th = 'Plain Teacher Name';
    }),
};

export const injectUnknownField: MutationPreset = {
  id: 'inject_unknown_field',
  label: 'Inject an unknown field',
  apply: (response) =>
    withFirstRow(response, (row) => {
      row.server_added_field = 'unexpected';
    }),
};

export const corruptTimeString: MutationPreset = {
  id: 'corrupt_time_string',
  label: 'Corrupt teach_time',
  apply: (response) =>
    withFirstRow(response, (row) => {
      row.teach_time = '99:99';
    }),
};

export const MUTATION_PRESETS: readonly MutationPreset[] = [
  dropTeachTime2,
  nullSubjectName,
  flipCountToNumber,
  stripTeacherHtml,
  injectUnknownField,
  corruptTimeString,
];
