import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadBlob, downloadText } from './download';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('download', () => {
  it('clicks a synthetic anchor for the blob and revokes the url', () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const blob = new Blob(['x'], { type: 'text/plain' });
    downloadBlob('plan.png', blob);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('sets the download name on the anchor', () => {
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: vi.fn(),
    });
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadName = this.download;
    });

    downloadBlob('plan.json', new Blob(['{}']));
    expect(downloadName).toBe('plan.json');
  });

  it('wraps text in a blob with the given type, defaulting to json', () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock');
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    downloadText('a.json', '{"a":1}');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('application/json');
  });
});
