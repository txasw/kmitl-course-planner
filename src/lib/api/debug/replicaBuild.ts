// The fingerprint of KCP's replica host bundle (tests/fixtures/host-fingerprint), which
// the debug build records beside the tested host builds so the end to end specs can
// serve the replica under a name KCP was never tested with and see the host check turn
// fill on (ADR-0079). It is a debug only module: the replica's parts are KCP's own code,
// never on the host, and production records none of it. A unit test checks it against
// the fixture, so the two never drift.

import type { RecordedBuild } from '../../regis/fingerprint/fingerprint';

/** @canary The marker the CI bundle check greps for (ADR-0014). */
export const DEBUG_CANARY = 'kcp-debug-canary';

export const REPLICA_BUILD: RecordedBuild = {
  builds: ['app.replica.js'],
  parts: {
    route: '68675ec7ffc8736e7b715bf952c46f93831b467196dfd61a030bc6b8aeb00382',
    header: 'd98aac4f0f02a2cb04b5c32d07a5a9d9dcb7356368366d4116859c4dc5d5e076',
    periods: '3d698d10e8d4e6fc439925efc5542815789d3d1a3b8244df103d597c1f2cf47b',
    panel: 'f796afee03df7dea0b0748b407458f83fd9ed80332367216b10b1a8e9b65c977',
    addSubject:
      '4a54d5c052ced8069d409f09a43ff2514bf5219c9ee7a2c2299d8a2bf262add8',
    patternTable:
      '1fac976a950c540eeb4835e0ad913e1b1094ac4039beb1747551833a29018740',
    subjectDialog:
      'a954ba5110a8c6df1bb3d4737a659043869d17595caf96aee0b4069723e3839f',
    stepper: '6a7b394b46c7c86e2e703bb5904dd7abb94acf6fa1797f039ea5578f8a483ee1',
    consent: 'f36fe38a71d7b8c187f6517a8e37dea427444e3cfe9d1c84564f0ef195318d63',
    flowChart:
      '95be762d6d231d7c57694463ae2b5f9c7020d93a1d6a2fbde7e04c7cbad2526d',
    complete:
      'efb812b0b8665ee3f503b5e82537ce1bbc231d61aca4d71a9c4296c1d2c66903',
    gradeDialog:
      '525a4c290ee46476473229c3835f8995ea186d4458387c595f393425c4493d75',
    periodCheck:
      '0f150091a31a4a60688655343cde9302e3081d5f4ad66bb311f68c7ec9e49ed0',
    client: '953a04087521180471ab62fa3599b36c6032ff59dbc407ae47ca91d3153b620f',
    writes: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    labels: 'edb78657b5a03987e25d11813a0da82887ca94301d724b0f26af4c69089d3313',
  },
};
