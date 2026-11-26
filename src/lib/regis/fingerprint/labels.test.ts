import { describe, expect, it } from 'vitest';
import { clickableLabels } from './labels';

describe('clickableLabels', () => {
  it('resolves a registration label of a clickable element in each language', () => {
    const source =
      'r=function(){return e(i.A,{on:{click:function(e){return A.go()}}},[A._v(A._s(A.$t("pre_regis_x.go")))])};' +
      'en={pre_regis_x:{go:"Go"}},th={pre_regis_x:{go:"ไป"}};';
    expect(clickableLabels(source)).toEqual(['Go', 'ไป']);
  });

  it('leaves out a label outside the registration namespaces', () => {
    const source =
      'r=function(){return e(i.A,{on:{click:function(e){return A.go()}}},[A._v(A._s(A.$t("home.go")))])};' +
      'en={home:{go:"Go"}};';
    expect(clickableLabels(source)).toEqual([]);
  });
});
