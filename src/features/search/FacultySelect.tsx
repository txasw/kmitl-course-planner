// The faculty select shared by the class fields, the category fields, and the
// curriculum profile picker. It lists faculties by id and stays disabled until the
// faculty reference list is ready.

import { Building2 } from 'lucide-react';
import { Combobox } from './Combobox';
import type { Locale, Translate } from '@/lib/i18n/t';
import type { RawFaculty } from '@/lib/domain/schemas';
import type { AsyncState } from '@/lib/utils/async';
import {
  facultyName,
  readyData,
  sortFacultiesById,
} from '@/lib/reference/filters';
import { ALL_OPTION } from '@/lib/search/formState';

interface FacultySelectProps {
  value: string;
  faculties: AsyncState<RawFaculty[]>;
  locale: Locale;
  t: Translate;
  onChange: (value: string) => void;
  /** Offer an all faculties option, verified only for the category tab. */
  includeAll?: boolean;
}

export function FacultySelect({
  value,
  faculties,
  locale,
  t,
  onChange,
  includeAll = false,
}: FacultySelectProps) {
  const options = [
    ...(includeAll
      ? [{ value: ALL_OPTION, label: t('search.facultyAll') }]
      : []),
    ...sortFacultiesById(readyData(faculties)).map((faculty) => ({
      value: faculty.FACULTY_ID,
      label: `${faculty.FACULTY_ID} ${facultyName(faculty, locale)}`,
    })),
  ];
  return (
    <Combobox
      label={t('search.faculty')}
      icon={Building2}
      value={value}
      placeholder={
        faculties.status === 'ready'
          ? t('search.selectPlaceholder')
          : t('search.optionsLoading')
      }
      disabled={faculties.status !== 'ready'}
      options={options}
      onChange={onChange}
    />
  );
}
