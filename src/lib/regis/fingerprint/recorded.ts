// The fingerprints of the host app builds KCP was tested against (ADR-0079), printed by
// scripts/host-fingerprint.mjs from the saved bundles. Builds that share every part's
// fingerprint share an entry: the redeploys of 2026-11-25 04:09 GMT and 2026-11-26
// 03:21 GMT changed staff pages only, so they read the same as the build before each.
// The route of 2026-11-25 09:53 GMT added the header, the periods, and the period check,
// and its labels, so it starts the second entry. The redeploy of 2026-11-26 09:38 GMT
// regrouped the menu data of the App's drawer, which the setup reads as one word since
// fingerprint version 4 (shell.ts), so it too reads the same as the build before it. A
// new build is added here only after a review, with the script's output for it.

import type { RecordedBuild } from './fingerprint.ts';

export const RECORDED_BUILDS: readonly RecordedBuild[] = [
  {
    builds: ['app.454d9e95.js', 'app.020e81ed.js'],
    parts: {
      route: 'd28d385c71516fb73e5cd4a36f82e8a6c7d631368392d8ca6658841ce93a9e39',
      panel: '700d0271f372419f4ec08f1d152322b17acb78d12dca7d73b246748098f07467',
      addSubject:
        '04f1ed02d34aa1200cb080e0564b4f4d6513973d63651559f3159afd0f0733fe',
      patternTable:
        '7b3d4fdfa2a8a9158d572b0185b65ad8e1118ab2d5639415ed5edc8c962b492b',
      subjectDialog:
        'e1deeec5102d764af01620cf11b0511ee13effd1e9fc4a7b0cb3ac1666cf4f21',
      stepper:
        '17a9a9ff858db5a2ea9ad03a1a424ea494eedf89ef6c8cc91655ced097140d62',
      consent:
        '1a07dfcc2c34e0c9de22def88e3a04a99d9e53406ab7681b0c3ee250c7d27397',
      flowChart:
        '7e71a8bcf1e6df8320287fbbc9d4aed43b704c6a55cf0b6b08bb63c5d29b1c48',
      complete:
        '9b5de63e577fc3e490e0f7d9b50258e3ca5402338a0d973765fad67b41f74474',
      gradeDialog:
        '1aeed084e86f2b911c29e2ccb8e487f19fe7850d6f14b1d2ede96bf1bd46ae0c',
      client:
        'c101a0afde53f6cf5e851c500d9ecad99e7160674f3f7699c16d9983b90b35a1',
      writes:
        '4566a4d6a8ea5c3a35bfef4d1b3b4a32bae4659469541d0a93c2c239898dcb76',
      store: 'ebbcfaeeacfef4fc23d171533b36c39654373b1c98f6e7d3a12b914bc601c074',
      setup: 'e34dff8f221c281a51d181794d3fa3d81f8f45dccdb77facac011ecb1a5bea0d',
      labels:
        '33a230da4818ec61e35dee38f078c94a79f88a5e5b23ece7e148f29e5c00135b',
    },
  },
  {
    builds: ['app.a1e43722.js', 'app.ba450963.js', 'app.2ef67281.js'],
    parts: {
      route: '976dfe4336a2eaa35f1494fa73742549c590e1c9dc834efadbb22d080d53a7b5',
      header:
        'd8ff3da2549ffd4d2d2fc36868b342c08caf219b48a8a70d05e39a8f7fa8892c',
      periods:
        '5f91508436279fe06cf59dcf4866c7ae0234a228b09367584583a0653867affa',
      panel: '700d0271f372419f4ec08f1d152322b17acb78d12dca7d73b246748098f07467',
      addSubject:
        '04f1ed02d34aa1200cb080e0564b4f4d6513973d63651559f3159afd0f0733fe',
      patternTable:
        '7b3d4fdfa2a8a9158d572b0185b65ad8e1118ab2d5639415ed5edc8c962b492b',
      subjectDialog:
        'e1deeec5102d764af01620cf11b0511ee13effd1e9fc4a7b0cb3ac1666cf4f21',
      stepper:
        '17a9a9ff858db5a2ea9ad03a1a424ea494eedf89ef6c8cc91655ced097140d62',
      consent:
        '1a07dfcc2c34e0c9de22def88e3a04a99d9e53406ab7681b0c3ee250c7d27397',
      flowChart:
        '7e71a8bcf1e6df8320287fbbc9d4aed43b704c6a55cf0b6b08bb63c5d29b1c48',
      complete:
        '9b5de63e577fc3e490e0f7d9b50258e3ca5402338a0d973765fad67b41f74474',
      gradeDialog:
        '1aeed084e86f2b911c29e2ccb8e487f19fe7850d6f14b1d2ede96bf1bd46ae0c',
      periodCheck:
        'bd0e99163d846e00f5357160cc64cc2393a1fe7552ba15e791a91601ed202024',
      client:
        'c101a0afde53f6cf5e851c500d9ecad99e7160674f3f7699c16d9983b90b35a1',
      writes:
        '4566a4d6a8ea5c3a35bfef4d1b3b4a32bae4659469541d0a93c2c239898dcb76',
      store: 'ebbcfaeeacfef4fc23d171533b36c39654373b1c98f6e7d3a12b914bc601c074',
      setup: 'e34dff8f221c281a51d181794d3fa3d81f8f45dccdb77facac011ecb1a5bea0d',
      labels:
        'a5a9e7fb69629a7eb389145f300d04c6310242035c17594e135ff74a5c2f4e35',
    },
  },
];
