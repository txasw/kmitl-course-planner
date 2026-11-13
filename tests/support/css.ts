// Serializes a CSS value through the test environment's own CSSOM, so an assertion
// compares what a style means rather than one engine's spelling of it, such as a
// unitless zero that one engine keeps and another writes as 0px. A value the engine
// rejects throws, so a typo in the expectation can never match an empty style.

export function serializedCss(property: string, value: string): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, value);
  const serialized = probe.style.getPropertyValue(property);
  if (serialized === '') {
    throw new Error(`the CSS engine rejected ${property}: ${value}`);
  }
  return serialized;
}
