export default defineBackground(() => {
  // The background service worker owns all network egress, schema validation,
  // and caching in later phases. It is intentionally empty during bootstrap.
});
