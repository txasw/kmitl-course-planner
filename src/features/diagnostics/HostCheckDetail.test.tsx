import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildCheckStore } from '@/features/regis/host/buildCheckStore';
import { HostCheckDetail, hostCheckText } from './HostCheckDetail';

afterEach(() => {
  buildCheckStore.setState({ check: null });
});

describe('HostCheckDetail', () => {
  it('names the parts that differ', () => {
    buildCheckStore.setState({
      check: {
        key: 'app.c0ffee01.js chunk-vendors.7ab4925e.js',
        verdict: { status: 'mismatch', parts: ['addSubject', 'labels'] },
      },
    });
    render(<HostCheckDetail />);
    expect(screen.getByTestId('kcp-host-check')).toHaveTextContent(
      'Host check: parts differ from the closest tested build: addSubject, labels',
    );
  });

  it('says why there is no fingerprint', () => {
    expect(hostCheckText({ status: 'unreadable' })).toContain(
      'could not be read',
    );
    expect(hostCheckText({ status: 'failed' })).toContain('did not complete');
    expect(hostCheckText({ status: 'untestedVendor' })).toContain('vendor');
    expect(hostCheckText(null)).toBe('Host check: running');
  });

  it('shows nothing before a check', () => {
    const { container } = render(<HostCheckDetail />);
    expect(container).toBeEmptyDOMElement();
  });
});
