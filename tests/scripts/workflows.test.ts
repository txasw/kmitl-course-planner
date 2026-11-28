import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';

// Pins the properties the site deploy relies on (ADR-0080): the token reaches one step
// of one job in the cloudflare-production environment, that job runs no package the
// build job installed, inputs reach scripts only through env, and every action in every
// workflow is pinned by commit SHA.

const WORKFLOWS = resolve(process.cwd(), '.github', 'workflows');

const stringMap = z.record(z.string(), z.string());

const stepSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  uses: z.string().optional(),
  run: z.string().optional(),
  with: z.record(z.string(), z.unknown()).optional(),
  env: stringMap.optional(),
});

const jobSchema = z.object({
  needs: z.string().optional(),
  if: z.string().optional(),
  environment: z
    .union([
      z.string(),
      z.object({ name: z.string(), url: z.string().optional() }),
    ])
    .optional(),
  permissions: stringMap.optional(),
  concurrency: z
    .object({ group: z.string(), 'cancel-in-progress': z.boolean() })
    .optional(),
  env: stringMap.optional(),
  outputs: stringMap.optional(),
  uses: z.string().optional(),
  with: z.record(z.string(), z.unknown()).optional(),
  secrets: z.unknown().optional(),
  steps: z.array(stepSchema).optional(),
});

const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  permissions: stringMap,
  env: z.unknown().optional(),
  jobs: z.record(z.string(), jobSchema),
});

type Job = z.infer<typeof jobSchema>;
type Step = z.infer<typeof stepSchema>;

function source(file: string): string {
  return readFileSync(join(WORKFLOWS, file), 'utf8');
}

function load(file: string): {
  tree: unknown;
  workflow: z.infer<typeof workflowSchema>;
} {
  const tree: unknown = parse(source(file));
  return { tree, workflow: workflowSchema.parse(tree) };
}

/** Every string in a parsed tree with its dotted path, such as jobs.deploy.steps.4.run. */
function strings(value: unknown, path = ''): [string, string][] {
  const at = (key: string): string => (path === '' ? key : `${path}.${key}`);
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => strings(item, at(String(index))));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      strings(item, at(key)),
    );
  }
  return [];
}

function job(jobs: Record<string, Job>, name: string): Job {
  const found = jobs[name];
  if (found === undefined) throw new Error(`no job ${name}`);
  return found;
}

function steps(found: Job): Step[] {
  return found.steps ?? [];
}

const deploySite = load('deploy-site.yml');
const deployJob = job(deploySite.workflow.jobs, 'deploy');
const buildJob = job(deploySite.workflow.jobs, 'build');

describe('deploy-site workflow', () => {
  it('is called with a commit and dispatched with a release tag', () => {
    const on = z
      .object({
        workflow_call: z.object({
          inputs: z.object({
            ref: z.object({
              required: z.literal(true),
              type: z.literal('string'),
            }),
          }),
        }),
        workflow_dispatch: z.object({
          inputs: z.object({
            tag: z.object({
              required: z.literal(true),
              type: z.literal('string'),
            }),
          }),
        }),
      })
      .strict()
      .safeParse(deploySite.workflow.on);
    expect(on.success, on.error?.message).toBe(true);

    const check = steps(buildJob)[0];
    expect(check?.id).toBe('ref');
    expect(check?.run).toContain(
      '[[ ! "$DISPATCH_TAG" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+$ ]]',
    );
    expect(check?.run).toContain('[[ ! "$CALL_REF" =~ ^[0-9a-f]{40}$ ]]');
  });

  it('passes inputs and outputs to scripts only through env', () => {
    for (const [path, value] of strings(deploySite.tree)) {
      if (path.endsWith('.run')) {
        expect(value, path).not.toContain('${{');
      }
      if (value.includes('inputs.')) {
        expect(path).toMatch(/\.env\.[A-Z_]+$/);
      }
    }
  });

  it('reads the repository and nothing more', () => {
    expect(deploySite.workflow.permissions).toEqual({ contents: 'read' });
    for (const found of Object.values(deploySite.workflow.jobs)) {
      expect(found.permissions).toEqual({ contents: 'read' });
    }
  });

  it('deploys in the approved environment, one deploy at a time', () => {
    expect(Object.keys(deploySite.workflow.jobs)).toEqual(['build', 'deploy']);
    expect(buildJob.environment).toBeUndefined();
    expect(deployJob.needs).toBe('build');
    expect(deployJob.environment).toEqual({
      name: 'cloudflare-production',
      url: 'https://kcp.cecs.sh/',
    });
    expect(deployJob.concurrency?.['cancel-in-progress']).toBe(false);
  });

  it('sets the token and the account id on the single deploy step only', () => {
    expect(deploySite.workflow.env).toBeUndefined();
    for (const found of Object.values(deploySite.workflow.jobs)) {
      expect(found.env).toBeUndefined();
    }
    const deploySteps = steps(deployJob);
    const last = deploySteps.length - 1;
    const prefix = `jobs.deploy.steps.${String(last)}.env.`;
    const secretPaths = strings(deploySite.tree)
      .filter(([, value]) => value.includes('secrets.'))
      .map(([path]) => path);
    expect(secretPaths).toEqual([`${prefix}CLOUDFLARE_API_TOKEN`]);
    const varPaths = strings(deploySite.tree)
      .filter(([, value]) => value.includes('vars.'))
      .map(([path]) => path);
    expect(varPaths).toEqual([`${prefix}CLOUDFLARE_ACCOUNT_ID`]);

    const step = deploySteps[last];
    expect(step?.env).toEqual({
      CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      CLOUDFLARE_ACCOUNT_ID: '${{ vars.CLOUDFLARE_ACCOUNT_ID }}',
      WRANGLER_SEND_METRICS: 'false',
    });
    expect(step?.run).toBe(
      '"${RUNNER_TEMP}/wrangler/node_modules/.bin/wrangler" deploy',
    );
  });

  it('runs no package the build job installed while the token is in scope', () => {
    const deploySteps = steps(deployJob);
    for (const step of deploySteps) {
      expect(step.run ?? '', step.name).not.toMatch(/\bpnpm\b|npx|npm ci/);
    }
    const install = deploySteps.find(
      (step) => step.name === 'Install Wrangler',
    );
    expect(install?.run).toContain('--ignore-scripts');
    expect(install?.run).toContain('--prefix "${RUNNER_TEMP}/wrangler"');
    expect(install?.run).toContain('"wrangler@${WRANGLER_VERSION}"');
    expect(install?.env).toEqual({
      WRANGLER_VERSION: '${{ needs.build.outputs.wrangler-version }}',
    });

    // The Wrangler configuration comes from the commit, never from the artifact.
    const checkout = deploySteps.find((step) =>
      step.uses?.startsWith('actions/checkout@'),
    );
    expect(checkout?.with).toEqual({
      ref: '${{ needs.build.outputs.commit }}',
      'persist-credentials': false,
      'sparse-checkout': '/wrangler.jsonc',
      'sparse-checkout-cone-mode': false,
    });
    const download = deploySteps.find((step) =>
      step.uses?.startsWith('actions/download-artifact@'),
    );
    expect(download?.with).toEqual({ name: 'site', path: 'site' });
  });

  it('checks out without persisting the repository token', () => {
    for (const found of [buildJob, deployJob]) {
      for (const step of steps(found)) {
        if (step.uses?.startsWith('actions/checkout@') === true) {
          expect(step.with?.['persist-credentials']).toBe(false);
        }
      }
    }
  });
});

describe('release workflow', () => {
  it('calls the site deploy with the released commit once a version is tagged', () => {
    const release = load('release.yml').workflow;
    expect(job(release.jobs, 'release').outputs?.published).toBe(
      '${{ steps.changesets.outputs.published }}',
    );
    const call = job(release.jobs, 'deploy-site');
    expect(call.uses).toBe('./.github/workflows/deploy-site.yml');
    expect(call.needs).toBe('release');
    expect(call.if).toBe("needs.release.outputs.published == 'true'");
    expect(call.with).toEqual({ ref: '${{ github.sha }}' });
    expect(call.secrets).toBeUndefined();
    expect(call.permissions).toEqual({ contents: 'read' });
  });
});

describe('workflow actions', () => {
  const files = readdirSync(WORKFLOWS).filter((file) => file.endsWith('.yml'));
  const uses = files.flatMap((file) =>
    source(file)
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = /^\s*(?:-\s+)?uses:\s*(\S+)\s*(.*)$/.exec(line);
        return match === null
          ? []
          : [{ file, ref: match[1] ?? '', comment: match[2] ?? '' }];
      }),
  );

  it('pins every action to a full commit SHA with its version', () => {
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) {
      if (use.ref.startsWith('./')) continue;
      expect(use.ref, use.file).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
      expect(use.comment, use.ref).toMatch(/^# v\d+\.\d+\.\d+$/);
    }
  });

  it('pins each action to one SHA across the workflows', () => {
    const pins = new Map<string, Set<string>>();
    for (const use of uses) {
      const [action, sha] = use.ref.split('@');
      if (action === undefined || sha === undefined) continue;
      pins.set(action, (pins.get(action) ?? new Set()).add(sha));
    }
    for (const [action, shas] of pins) {
      expect(shas.size, action).toBe(1);
    }
  });
});
