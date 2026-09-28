import { beforeAll, describe, expect, inject, it } from 'vitest';

import { ApiError, type RestClient } from '@cadastre/api-client';
import type {
  CaseParameterDto,
  CaseProvisionDto,
  FileInput,
} from '@cadastre/api-contracts/verification';

import { asOperator } from '../harness/sign-in.js';

let api: RestClient;

/*
 * The route an operator states one of the six figures of the Article 8 table
 * through (COMM-193).
 *
 * What this set can reach is the edge: the schema in front of the handler, the
 * refusals and the statuses they come back as, and what the package publishes
 * after one. It cannot reach an override that *changes a provision*, because no
 * bytes are ever uploaded here — the pipeline finds nothing to split, so these
 * packages hold no papers for a figure to be read off and overruled. Which
 * provision an override selects, and what the card is then shown, is the
 * domain's own set (`case-provision.service.spec.ts`).
 *
 * Signed in as the office, because the route is the office's own; who may call
 * it and who gets a 403 is the table in `auth/access.e2e.spec.ts`.
 */
beforeAll(async () => {
  api = await asOperator(inject('baseUrl'));
});

const MISSING = '00000000-0000-4000-8000-000000000000';

async function presigned(names: readonly string[]): Promise<FileInput[]> {
  return Promise.all(
    names.map(async name => {
      const { body } = await api.documents.presign({
        filename: name,
        contentType: 'application/pdf',
        size: 2048,
      });

      return {
        originalFilename: name,
        contentType: 'application/pdf',
        storageKey: body.key,
      };
    }),
  );
}

/*
 * A package with its run behind it.
 *
 * Creating a package starts a run, and a run under way is a state the route
 * answers differently: `PACKAGE_NOT_TAKING_FILES` pre-empts every refusal
 * further down whenever it reaches the aggregate first. Waiting for the run out
 * here pins the package in a state every case can name, so the same status
 * comes back on every machine (COMM-128).
 */
async function aPackage(): Promise<string> {
  const { body } = await api.packages.create({
    profileKey: 'cadastre',
    files: await presigned(['sexsiyyet-vesiqe.pdf']),
  });

  return settled(body.id);
}

/*
 * The package once the run over it is behind it.
 *
 * Waited for before every write and between two of them: a statement re-opens
 * the package and starts a run, and a second statement sent while that run is
 * saving loses the race on the aggregate's version. That is the system working
 * — an operator cannot type over a package being read — but it is not what
 * these cases are about, so they wait rather than assert on who won.
 */
async function settled(id: string, timeoutMs = 45_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const { body: current } = await api.packages.findOne(id);

    if (current.status === 'Completed' || current.status === 'Failed') {
      return id;
    }

    if (Date.now() > deadline) {
      throw new Error(`package ${id} was still ${current.status}`);
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

const refusalOf = async (call: Promise<unknown>): Promise<ApiError> =>
  call.then(
    () => {
      throw new Error('that call was supposed to be refused');
    },
    (error: unknown) => error as ApiError,
  );

const parameterOf = (
  provision: CaseProvisionDto | null,
  parameter: CaseParameterDto['parameter'],
): CaseParameterDto | undefined =>
  provision?.parameters.find(one => one.parameter === parameter);

describe('the route an operator states a case parameter through', () => {
  it('answers PACKAGE_NOT_FOUND for a package nobody submitted', async () => {
    // act
    const failure = await refusalOf(
      api.packages.stateCaseParameters(MISSING, {
        parameters: [{ parameter: 'storeys', value: 3 }],
      }),
    );

    // assert
    expect(failure.body.statusCode).toBe(404);
    expect(failure.body.code).toBe('PACKAGE_NOT_FOUND');
  });

  /*
   * The happy path, all the way out to the resource: the figure the operator
   * set is what the table was decided on, the source says who decided it, and
   * the audit is beside it. The package's own papers state no storeys here, so
   * `read` is the nothing the engine had — which is the case an override exists
   * for, since no field edit could have set it.
   */
  it('states the figure, and answers with the package it now decides', async () => {
    // arrange
    const id = await aPackage();

    // act
    const { status, body } = await api.packages.stateCaseParameters(id, {
      parameters: [{ parameter: 'storeys', value: 3 }],
    });

    // assert
    expect(status).toBe(200);

    const storeys = parameterOf(body.provision, 'storeys');
    expect(storeys).toMatchObject({
      value: 3,
      source: 'StatedByOperator',
      stated: '3',
      from: null,
      read: { value: null, source: null },
    });
    expect(storeys?.overriddenBy?.accountId).toEqual(expect.any(String));
    expect(Date.parse(storeys?.overriddenBy?.at ?? '')).not.toBeNaN();
  });

  it('saves every figure of one form together', async () => {
    // arrange
    const id = await aPackage();

    // act
    const { body } = await api.packages.stateCaseParameters(id, {
      parameters: [
        { parameter: 'builtYear', value: 2014 },
        { parameter: 'height', value: 7.4 },
        { parameter: 'landRight', value: 'Ownership' },
      ],
    });

    // assert
    expect(parameterOf(body.provision, 'builtYear')?.value).toBe(2014);
    expect(parameterOf(body.provision, 'height')?.value).toBe(7.4);
    expect(parameterOf(body.provision, 'landRight')?.value).toBe('Ownership');
  });

  // The revert, and the only way back: while an override stands, nothing the
  // engine reads displaces it.
  it('gives the figure back to the papers when it is cleared', async () => {
    // arrange
    const id = await aPackage();
    await api.packages.stateCaseParameters(id, {
      parameters: [{ parameter: 'storeys', value: 3 }],
    });
    await settled(id);

    // act
    const { body } = await api.packages.stateCaseParameters(id, {
      parameters: [{ parameter: 'storeys', value: null }],
    });

    // assert
    expect(parameterOf(body.provision, 'storeys')).toMatchObject({
      value: null,
      source: null,
      overriddenBy: null,
      read: null,
    });
  });

  /*
   * The body is the whole of what this takes, and the schema is what says so —
   * every one of these is a 400 from the global pipe and never a call into the
   * context. An override is believed absolutely, so a figure the table could
   * never be decided on must not reach the package at all.
   */
  it.each([
    ['no entries at all', { parameters: [] }],
    ['no parameters at all', {}],
    [
      'a parameter nothing names',
      { parameters: [{ parameter: 'colour', value: 1 }] },
    ],
    [
      'a year outside the window a paper can be dated in',
      { parameters: [{ parameter: 'builtYear', value: 999 }] },
    ],
    [
      'a year that is not whole',
      { parameters: [{ parameter: 'builtYear', value: 1999.5 }] },
    ],
    [
      'a count of no storeys',
      { parameters: [{ parameter: 'storeys', value: 0 }] },
    ],
    [
      'a fraction of a storey',
      { parameters: [{ parameter: 'storeys', value: 2.5 }] },
    ],
    [
      'a height of nought metres',
      { parameters: [{ parameter: 'height', value: 0 }] },
    ],
    ['a negative span', { parameters: [{ parameter: 'span', value: -4 }] }],
    [
      'a right nothing classes',
      { parameters: [{ parameter: 'landRight', value: 'Freehold' }] },
    ],
    [
      'a purpose nothing classes',
      { parameters: [{ parameter: 'purpose', value: 'Industrial' }] },
    ],
    [
      'a figure as text rather than a number',
      { parameters: [{ parameter: 'storeys', value: '3' }] },
    ],
    [
      'one figure twice',
      {
        parameters: [
          { parameter: 'storeys', value: 2 },
          { parameter: 'storeys', value: 3 },
        ],
      },
    ],
  ])('refuses %s before any handler is asked', async (_case, body) => {
    // arrange
    const id = await aPackage();

    // act
    const failure = await refusalOf(
      api.packages.stateCaseParametersRaw(id, body),
    );

    // assert
    expect(failure.body.statusCode).toBe(400);
    expect(failure.body.code).toBe('VALIDATION_FAILED');
  });

  /*
   * A refused statement changes nothing. The call that works out what to
   * discard runs after every refusal, and a package left short of its report by
   * a statement the route turned away would be the worst of both.
   */
  it('leaves the package exactly as it was when it refuses', async () => {
    // arrange
    const id = await aPackage();
    const { body: before } = await api.packages.findOne(id);

    // act
    await refusalOf(
      api.packages.stateCaseParametersRaw(id, {
        parameters: [{ parameter: 'storeys', value: 0 }],
      }),
    );

    // assert
    const { body: after } = await api.packages.findOne(id);
    expect(after.status).toBe(before.status);
    expect(after.report?.generatedAt).toBe(before.report?.generatedAt);
    expect(after.provision).toEqual(before.provision);
  });
});
