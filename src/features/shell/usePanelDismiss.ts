// The outside press dismiss of every panel popover and menu, with floating-ui's useDismiss.
// floating-ui listens on the document, which sees a press inside KCP's closed shadow root
// retargeted to the shadow host, so it cannot tell a press on the trigger from one
// elsewhere in KCP. A press on the trigger of an open menu then closed it on pointerdown,
// and the trigger's own click opened it again. The trigger records its own press here, as
// React handles it inside the root before floating-ui judges the press at the host, so
// that press never counts as outside. The floating node needs no such help: floating-ui
// already marks a press inside it through React.

import { useMemo, useRef, type PointerEvent } from 'react';
import {
  useDismiss,
  type ElementProps,
  type FloatingRootContext,
  type UseDismissProps,
} from '@floating-ui/react';

export function usePanelDismiss(
  context: FloatingRootContext,
  props: Omit<UseDismissProps, 'outsidePress'> = {},
): ElementProps {
  const pressed = useRef<Event | null>(null);
  const dismiss = useDismiss(context, {
    ...props,
    outsidePress: (event) => event !== pressed.current,
  });
  return useMemo(
    () => ({
      ...dismiss,
      reference: {
        ...dismiss.reference,
        onPointerDown: (event: PointerEvent) => {
          pressed.current = event.nativeEvent;
          dismiss.reference?.onPointerDown?.(event);
        },
      },
    }),
    [dismiss],
  );
}
