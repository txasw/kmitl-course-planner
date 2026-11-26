// The parts of the host app bundle the host check fingerprints (ADR-0079), by name. This
// module imports nothing, so the verdict schema the helper reads can name the parts
// without pulling the extraction into the content script.

/** The page components KCP reads or acts on, by the name the host gives each. */
export const COMPONENT_PARTS = {
  route: 'PreRegistration',
  header: 'RegistrationHeader',
  periods: 'RegistrationPeriods',
  panel: 'PreRegistrationPanel',
  addSubject: 'PreRegisAddSubject',
  patternTable: 'PatternTable',
  subjectDialog: 'SubjectDialog',
  stepper: 'PreRegisStepper',
  consent: 'PreRegisConfirmConsent',
  flowChart: 'PreRegisFlowChart',
  complete: 'PreRegisComplete',
} as const;

export type ComponentPart = keyof typeof COMPONENT_PARTS;

export const PART_IDS = [
  ...(Object.keys(COMPONENT_PARTS) as ComponentPart[]),
  'gradeDialog',
  'periodCheck',
  'client',
  'writes',
  'labels',
] as const;

export type PartId = (typeof PART_IDS)[number];
