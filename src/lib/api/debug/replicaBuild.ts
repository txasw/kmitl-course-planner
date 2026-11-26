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
    route: '759c133615f125554c8d3a5caa56a47fc269220e2d7d4f8c05e0813e382b5a4e',
    header: 'a7c68c982b2da15a63d02b892a622f121718acaadd97584d7d203826da2b99a7',
    periods: 'a72fc6007511e6cafb594094384c1f8797db27d1f3b1b4dd033203340f6cb8ce',
    panel: '43f77e3e30641f95562751897bc2d5f925cd3d4bceb34db48324359e1d37588e',
    addSubject:
      'd74fcbd3cecaf378d06fba3a36364ec01c3ae1ebb7872db179d60c956a7e093a',
    patternTable:
      '407e80c27db31d31d2000c3a324888c4dd3fd5dc89eba838a1267a7a843ef2d7',
    subjectDialog:
      '5fbae2506bb65096a4693e352ebec724e884b44916ccfd66d7ba41a9f72f07ec',
    stepper: '50126df04eb0001979853b5c3aedbaaad68a5c270ce0b36395cca17cc5386d6a',
    consent: '1f5d756f54363f7fab950a3fc82b5cf37190369032e37eae97bfab8272fe9979',
    flowChart:
      'bdc5b78d9ed90162ed687a5ce5e6e32d52e2c702845450e22f5647761fd93974',
    complete:
      '76c879eb6c146075c39a7d38f5ef704ce72e069fc1f951bf5e46034d014cea58',
    gradeDialog:
      '7cdc195f5736ebe1339bd1286d6eff6f075dfe7f521db7d6b8aef87c59c1a006',
    periodCheck:
      '5851de788b7c4f0f34d98dc3e00cf0c314e8d74c5f8c2508e3ee1b78d63d4ca6',
    client: '3fa81115a7a42db6a5f1abba652b505d807992805d197169e055b83b3624acc4',
    writes: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    store: '8d65ab75fa74e901e1bba1cce3f3ee07065d1f1bfcfeec1f274514b0fcb7c61d',
    setup: '015a7fe317489f38ad937c8f94b40b6f6d412098e726670171e13077804de424',
    labels: 'edb78657b5a03987e25d11813a0da82887ca94301d724b0f26af4c69089d3313',
  },
};
