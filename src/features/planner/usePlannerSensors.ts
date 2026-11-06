// The sensor set of the planner drag context (ADR-0058): a mouse sensor that starts after
// a short distance and a touch sensor that starts after a long press. No keyboard sensor
// is registered. The grip commits on Enter or Space through its own click handler, so
// there is no arrow key move machinery to arm, which would be meaningless when every
// placement is fixed. Exported as a hook so a component test drives the same sensors.

import {
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  MOUSE_ACTIVATION_DISTANCE_PX,
  TOUCH_ACTIVATION_DELAY_MS,
  TOUCH_TOLERANCE_PX,
} from './touchInput';

export function usePlannerSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: MOUSE_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_TOLERANCE_PX,
      },
    }),
  );
}
