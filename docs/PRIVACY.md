# Privacy

KMITL Course Planner keeps all data inside your browser. It has no backend, sends
no analytics or telemetry of any kind, and loads no remote scripts or fonts at
runtime. Course data is read from the public KMITL endpoints that the
registration site itself calls, and it is used only to render your planner.

## Data storage

Your saved plans and the cached reference data live in the browser extension
storage on your own device. Nothing is uploaded anywhere. Removing the extension
removes this data.

## Permissions

The extension requests the minimum permissions that make the product work.

- `storage`: save your plans and cache reference data locally so the interface
  loads quickly and your plans survive page reloads.
- Host access to `https://regis.reg.kmitl.ac.th/*`: run the planner interface on
  the registration site and read the public teach table data.
- Host access to `https://api.reg.kmitl.ac.th/*`: read the public faculty,
  department, curriculum, and subject reference data.

The extension requests no access to tabs, browsing history, or any other site.

## Diagnostics

Development builds include a diagnostics view for catching data contract changes
during development. It runs only in the development flavor, never in the
published extension, and any report it produces stays on your machine.
