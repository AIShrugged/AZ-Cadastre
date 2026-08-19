import { describe, expect, it } from 'vitest';

import { VerificationProfile } from '../../../domain/value-objects/index.js';

import { ListProfilesHandler } from './list-profiles.handler.js';

describe('ListProfilesHandler', () => {
  it('answers with every profile the domain declares, in the order it declares them', async () => {
    const profiles = await new ListProfilesHandler().execute();

    expect(profiles.map(profile => profile.key)).toEqual(
      VerificationProfile.all.map(profile => profile.key),
    );
  });

  it('answers with the document types each profile expects', async () => {
    const profiles = await new ListProfilesHandler().execute();

    for (const view of profiles) {
      expect(view.documentTypes.map(type => type.key)).toEqual(
        VerificationProfile.of(view.key).documentTypes.map(type => type.value),
      );
    }
  });

  it('says which of them a package cannot be complete without', async () => {
    const profiles = await new ListProfilesHandler().execute();

    for (const view of profiles) {
      const required = view.documentTypes
        .filter(type => type.required)
        .map(type => type.key);

      expect(required).toEqual(
        VerificationProfile.of(view.key).requiredTypes.map(type => type.value),
      );
    }
  });

  it('names only types the profile recognises, so the picker cannot offer a stray one', async () => {
    const profiles = await new ListProfilesHandler().execute();

    for (const view of profiles) {
      const profile = VerificationProfile.of(view.key);

      for (const type of profile.documentTypes) {
        expect(profile.recognises(type)).toBe(true);
      }
      expect(view.documentTypes.map(type => type.key)).not.toContain('unknown');
    }
  });

  it("names the fields each type's schema declares, so a caller can say what the document contributes", async () => {
    const profiles = await new ListProfilesHandler().execute();

    for (const view of profiles) {
      const profile = VerificationProfile.of(view.key);

      for (const type of view.documentTypes) {
        expect(type.fields).toEqual(
          profile
            .schemaFor(
              profile.documentTypes.find(
                candidate => candidate.value === type.key,
              )!,
            )
            .specs.map(spec => spec.key.value),
        );
      }
    }
  });

  it('takes no port: a profile is policy in code, so there is nothing to read', () => {
    expect(ListProfilesHandler.length).toBe(0);
  });
});
