// The icon of a helper status. The loader turns only without a reduced motion preference;
// under it, it stands as an open arc, distinct from the full ring of a subject not added.

import type { HelperStatus } from '@/lib/regis/helperStatus';
import { SPIN, STATUS_ICON } from './statusMeta';

interface StatusIconProps {
  status: HelperStatus;
  size: number;
  className: string;
}

export function StatusIcon({ status, size, className }: StatusIconProps) {
  const Icon = STATUS_ICON[status];
  return (
    <Icon
      size={size}
      aria-hidden
      className={`shrink-0 ${status === 'adding' ? SPIN : ''} ${className}`}
    />
  );
}
