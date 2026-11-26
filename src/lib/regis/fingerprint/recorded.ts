// The fingerprints of the host app builds KCP was tested against (ADR-0079), printed by
// scripts/host-fingerprint.mjs from the saved bundles. Builds that share every part's
// fingerprint share an entry: the redeploys of 2026-11-25 04:09 GMT and 2026-11-26
// 03:21 GMT changed staff pages only, so they read the same as the build before each.
// The route of 2026-11-25 09:53 GMT added the header, the periods, and the period check,
// and its labels, so it starts the second entry. A new build is added here only after a
// review, with the script's output for it.

import type { RecordedBuild } from './fingerprint.ts';

export const RECORDED_BUILDS: readonly RecordedBuild[] = [
  {
    builds: ['app.454d9e95.js', 'app.020e81ed.js'],
    parts: {
      route: '4be570d72bd75a0d2a5eb69b88b6b62fc39714d90aa1558ded04814c1fc00c54',
      panel: 'd2ae446e49f0ef78c2eacd5e2537657e557d0abf6bbe12655f571a9a2a008f36',
      addSubject:
        'bf553712a97b162d4515d90a696e7e377cff3e4f3ff718b1f7e012da908d5905',
      patternTable:
        'bc0fff7bceae25dbbeeb7a1ec9f64a195e912174ef32a1bf55b56af5babf32c9',
      subjectDialog:
        '695b7657782808d5b781b16cc47b8cc647a5de346adb76f68efe0214814f7510',
      stepper:
        'eec9a04b2c4e3e2d5c1e64c1189fdd23ada321a37fef232fb635577e25276075',
      consent:
        '396c475a73cbba983494d8773f88e85fbfb93113189425117203c39ba07d8993',
      flowChart:
        '7a580b7d1828cb77fe3e62101e016bb6bd903dc554fcc3809f2b535e2b43666e',
      complete:
        'f6ed3d07c4347f107d5c4113a81daac82f28b8da8a6036d2d348f7d1d06cde81',
      gradeDialog:
        '8ae273a47de8bb4679aa9472ad253acf68c2165c575e219146fab0759aefb13c',
      client:
        'befe39511e066cc8376e8511e3cfe7145636bc97f7e18f67befdb3b57a96a0a8',
      writes:
        '4566a4d6a8ea5c3a35bfef4d1b3b4a32bae4659469541d0a93c2c239898dcb76',
      labels:
        '33a230da4818ec61e35dee38f078c94a79f88a5e5b23ece7e148f29e5c00135b',
    },
  },
  {
    builds: ['app.a1e43722.js', 'app.ba450963.js'],
    parts: {
      route: '84ebeb09605a28dd6efa244c1ee52b2eec153d9dfe4435550180bbdce684eff7',
      header:
        'b5437dadc93ca223254425cb4b53d172c2b092ec346643d559f53829835081a5',
      periods:
        'f978b8396e3a3e5ed53adbfe6da89fec68618f7910f2e0cc6c1bd5819545f51c',
      panel: 'd2ae446e49f0ef78c2eacd5e2537657e557d0abf6bbe12655f571a9a2a008f36',
      addSubject:
        'bf553712a97b162d4515d90a696e7e377cff3e4f3ff718b1f7e012da908d5905',
      patternTable:
        'bc0fff7bceae25dbbeeb7a1ec9f64a195e912174ef32a1bf55b56af5babf32c9',
      subjectDialog:
        '695b7657782808d5b781b16cc47b8cc647a5de346adb76f68efe0214814f7510',
      stepper:
        'eec9a04b2c4e3e2d5c1e64c1189fdd23ada321a37fef232fb635577e25276075',
      consent:
        '396c475a73cbba983494d8773f88e85fbfb93113189425117203c39ba07d8993',
      flowChart:
        '7a580b7d1828cb77fe3e62101e016bb6bd903dc554fcc3809f2b535e2b43666e',
      complete:
        'f6ed3d07c4347f107d5c4113a81daac82f28b8da8a6036d2d348f7d1d06cde81',
      gradeDialog:
        '8ae273a47de8bb4679aa9472ad253acf68c2165c575e219146fab0759aefb13c',
      periodCheck:
        'e64bc851fc51e71a8ac512747b5378a6f9cdb647651d2c538aef10402aaf18e8',
      client:
        'befe39511e066cc8376e8511e3cfe7145636bc97f7e18f67befdb3b57a96a0a8',
      writes:
        '4566a4d6a8ea5c3a35bfef4d1b3b4a32bae4659469541d0a93c2c239898dcb76',
      labels:
        'a5a9e7fb69629a7eb389145f300d04c6310242035c17594e135ff74a5c2f4e35',
    },
  },
];
