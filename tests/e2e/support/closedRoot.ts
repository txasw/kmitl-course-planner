// Reaches into the production build's closed shadow root, which no locator can pierce.
// The Chrome DevTools Protocol reads the whole tree with closed roots included, finds a
// node by a predicate over its attributes and text, and gives its box, so a spec can tap
// the node where a student would and read what the tree shows after.

import type { CDPSession, Page } from '@playwright/test';

export interface DomNode {
  nodeName: string;
  nodeType: number;
  backendNodeId: number;
  nodeValue?: string;
  attributes?: string[];
  children?: DomNode[];
  shadowRoots?: DomNode[];
}

export function attr(node: DomNode, name: string): string | undefined {
  const list = node.attributes ?? [];
  for (let index = 0; index < list.length; index += 2) {
    if (list[index] === name) return list[index + 1];
  }
  return undefined;
}

/** The text a node holds, closed roots included. */
export function textOf(node: DomNode): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  return [...(node.shadowRoots ?? []), ...(node.children ?? [])]
    .map(textOf)
    .join('');
}

export class ClosedRoot {
  private constructor(
    private readonly page: Page,
    private readonly cdp: CDPSession,
  ) {}

  static async attach(page: Page): Promise<ClosedRoot> {
    return new ClosedRoot(page, await page.context().newCDPSession(page));
  }

  /** Every node that matches, in document order, closed roots included. */
  async findAll(match: (node: DomNode) => boolean): Promise<DomNode[]> {
    const { root } = (await this.cdp.send('DOM.getDocument', {
      depth: -1,
      pierce: true,
    })) as { root: DomNode };
    const found: DomNode[] = [];
    const walk = (node: DomNode): void => {
      if (match(node)) found.push(node);
      for (const child of [
        ...(node.shadowRoots ?? []),
        ...(node.children ?? []),
      ]) {
        walk(child);
      }
    };
    walk(root);
    return found;
  }

  async find(match: (node: DomNode) => boolean): Promise<DomNode | null> {
    return (await this.findAll(match))[0] ?? null;
  }

  /** Wait until a node matches, as a locator would, and return it. */
  async waitFor(
    match: (node: DomNode) => boolean,
    what: string,
    timeout = 10_000,
  ): Promise<DomNode> {
    const until = Date.now() + timeout;
    for (;;) {
      const node = await this.find(match);
      if (node !== null) return node;
      if (Date.now() > until) throw new Error(`no ${what} in the closed root`);
      await this.page.waitForTimeout(100);
    }
  }

  /** Wait until no node matches. */
  async waitGone(
    match: (node: DomNode) => boolean,
    what: string,
    timeout = 10_000,
  ): Promise<void> {
    const until = Date.now() + timeout;
    while ((await this.find(match)) !== null) {
      if (Date.now() > until) throw new Error(`${what} is still shown`);
      await this.page.waitForTimeout(100);
    }
  }

  /** Tap the centre of a node with the touchscreen, as a phone press would. */
  async tap(match: (node: DomNode) => boolean, what: string): Promise<void> {
    const node = await this.waitFor(match, what);
    const { model } = (await this.cdp.send('DOM.getBoxModel', {
      backendNodeId: node.backendNodeId,
    })) as { model: { border: number[] } };
    const [x1 = 0, y1 = 0, , , x3 = 0, y3 = 0] = model.border;
    await this.page.touchscreen.tap((x1 + x3) / 2, (y1 + y3) / 2);
  }
}

/** A node with an attribute of this value. */
export function withAttr(name: string, value: string) {
  return (node: DomNode): boolean => attr(node, name) === value;
}

/** A node of a role whose text or label holds the words. */
export function roleNamed(role: string, words: string) {
  return (node: DomNode): boolean =>
    attr(node, 'role') === role &&
    ((attr(node, 'aria-label') ?? '').includes(words) ||
      textOf(node).includes(words));
}
