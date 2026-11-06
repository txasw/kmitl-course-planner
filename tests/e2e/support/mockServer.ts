// An in process HTTPS server that stands in for the two KMITL origins during end
// to end runs. The extension is launched with host resolver rules that map both
// origins to this server and with certificate errors ignored, so the extension
// service worker's fetches and the host page navigation resolve here
// deterministically. HTTPS is required because the content script matches and the
// host permissions are scheme sensitive; the self signed certificate is generated
// in process so the harness needs no committed key and works the same on every
// platform. The api failure flag drives the retry spec.

import { createServer, type Server } from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generate } from 'selfsigned';
import { denseCatalogJson } from './denseCatalog';

const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures');

function fixtureBody(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, name), 'utf8');
}

// A minimal document on the regis origin is enough for the content script to
// mount; the extension UI reads its data from the gateway, not the host DOM. The
// device width viewport makes a mobile emulated run lay out at the device width
// instead of the 980 px default a page without the tag gets, so the phone project
// exercises the small screen layout. Desktop runs ignore the tag. The document
// declares no language, so the panel cannot pass on an inherited one and the specs
// see the language the panel sets on itself.
const HOST_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KMITL</title></head><body></body></html>';

export interface MockServer {
  port: number;
  setApiFailure: (fail: boolean) => void;
  /** Serve the moved time variant of the synthetic catalog so a revalidation replay
   * sees a changed section. Off by default, so the block interaction specs that share
   * the synthetic id keep the stable base catalog. */
  setFreshSynthetic: (fresh: boolean) => void;
  close: () => Promise<void>;
}

export async function startMockServer(): Promise<MockServer> {
  const pems = await generate([{ name: 'commonName', value: 'localhost' }]);
  let apiFailure = false;
  let freshSynthetic = false;

  const server: Server = createServer(
    { key: pems.private, cert: pems.cert },
    (req, res) => {
      // Close each connection rather than keeping it alive, so each request runs
      // on a fresh connection and no test depends on connection reuse.
      res.setHeader('Connection', 'close');
      const host = (req.headers.host ?? '').split(':')[0] ?? '';
      const url = new URL(req.url ?? '/', `https://${host}`);
      const fn = url.searchParams.get('function');

      const sendJson = (name: string): void => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(fixtureBody(name));
      };

      const sendBody = (body: string): void => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(body);
      };

      if (host === 'api.reg.kmitl.ac.th') {
        if (fn === 'get-faculty') {
          sendJson('faculty.capture.json');
          return;
        }
        if (fn === 'get-registrar-department') {
          sendJson('department.capture.json');
          return;
        }
        if (fn === 'get-curriculum') {
          sendJson('curriculum.level1.capture.json');
          return;
        }
        if (fn === 'get-reference') {
          sendJson('subject-owner.capture.json');
          return;
        }
      }

      if (host === 'regis.reg.kmitl.ac.th') {
        if (url.pathname.startsWith('/api')) {
          // The current registration term seeds the form default once per session.
          // It is answered before the failure flag, which targets teach table
          // queries, so the default term is the same in every spec.
          if (fn === 'get-year-semester-now') {
            sendJson('year-semester-now.capture.json');
            return;
          }
          if (apiFailure) {
            // Fail with a fully read 200 whose body is not the array the schema
            // expects, so the gateway drains the whole response over a single
            // socket, exactly like a successful request, and surfaces a terminal
            // ValidationError. A 5xx is instead retried over several sockets whose
            // rapid teardown intermittently poisoned the client connection state
            // and failed the following recovery fetch; that was the flake this
            // replaces. The catalog error state is identical for any failed query.
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"error":"unavailable"}');
            return;
          }
          // Mirror the real API: a present but empty selected_class_year is
          // rejected as "not integer". Absent (by_subject_id) or 0 is accepted.
          if (url.searchParams.get('selected_class_year') === '') {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ selected_class_year: ['not integer'] }));
            return;
          }
          // The by_class all curricula query returns a broader result that
          // includes unscheduled rows with a null teachtime_str, so serve the
          // regression capture on that path to exercise the schema against them.
          if (
            url.searchParams.get('mode') === 'by_class' &&
            url.searchParams.get('search_all_curriculum') === 'true'
          ) {
            sendJson(
              'regressions/teach-table.by_class-null-teachtime-str.capture.json',
            );
            return;
          }
          // The real by_class capture, the computer engineering and cybersecurity
          // curriculum 137 of faculty 01, department 05, whose group 2 courses the plan
          // suggestion spec searches. Served for that one curriculum so every other
          // by_class search keeps its current response.
          if (
            url.searchParams.get('mode') === 'by_class' &&
            url.searchParams.get('selected_curriculum') === '137'
          ) {
            sendJson('teach-table.by_class.capture.json');
            return;
          }
          // A synthetic catalog of overlapping and multi section courses the block
          // move and swap specs need, served for one reserved subject id so no other
          // spec sees it.
          if (url.searchParams.get('selected_subject_id') === '90000000') {
            sendJson(
              freshSynthetic
                ? 'synthetic.block-interactions.fresh.json'
                : 'synthetic.block-interactions.json',
            );
            return;
          }
          // Two courses on different days, so both add without a time conflict, whose
          // midterm windows overlap. Served for a reserved id so only the exam overlap
          // spec sees them.
          if (url.searchParams.get('selected_subject_id') === '90000010') {
            sendJson('synthetic.exam-overlap.json');
            return;
          }
          // The real by_subject_id capture, 499 raw rows that dedupe to 44 unique
          // sections, served for a reserved id so the profiling spec can measure the
          // normalize path against the real payload at its real scale.
          if (url.searchParams.get('selected_subject_id') === '90000499') {
            sendJson('teach-table.by_subject_id.capture.json');
            return;
          }
          // The synthetic dense catalog, hundreds of open sections, served for a
          // reserved id so the profiling spec can measure the render and drag at the
          // acceptance scale the 44 section real capture cannot reach.
          if (url.searchParams.get('selected_subject_id') === '90000500') {
            sendBody(denseCatalogJson());
            return;
          }
          // A catalog of three hour blocks with long Thai and English names, Thai place
          // strings, a 34 and 35 pair, and exam windows on three of its four subjects, the
          // shape the export fit guard measures so no block foot and no exam line clips at
          // any preset. Served for a reserved id so no other spec sees it.
          if (url.searchParams.get('selected_subject_id') === '90000600') {
            sendJson('regressions/teach-table.fit-regression.json');
            return;
          }
          // The real capture with exam windows, 331 rows whose meetings reach 20:00 and
          // both weekend days, served for a reserved id so the grid window spec can load a
          // broad result that widens the edit grid past its column.
          if (url.searchParams.get('selected_subject_id') === '90000700') {
            sendJson('teach-table.with-exams.capture.json');
            return;
          }
          sendJson('teach-table.by_subject_owner_id-32.capture.json');
          return;
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(HOST_HTML);
        return;
      }

      res.writeHead(404);
      res.end('not found');
    },
  );

  // Do not hold keep-alive connections open; each request gets a fresh one.
  server.keepAliveTimeout = 0;
  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('mock server did not bind a numeric port');
  }
  const { port } = address;

  return {
    port,
    setApiFailure: (fail) => {
      apiFailure = fail;
    },
    setFreshSynthetic: (fresh) => {
      freshSynthetic = fresh;
    },
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
          } else {
            resolveClose();
          }
        });
      }),
  };
}
