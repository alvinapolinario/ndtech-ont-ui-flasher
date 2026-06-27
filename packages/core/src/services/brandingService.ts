/** Branding profile CRUD + JSON export. */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  validateProfileInput,
  withDefaults,
  saveProfileToFile,
} from '@ndtech/branding-engine';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { NotFoundError, ValidationError, ConflictError } from '../errors.js';
import { toProfile } from '../mappers.js';
import type { BrandingProfile, BrandingProfileInput } from '@ndtech/shared';

export async function listProfiles(): Promise<BrandingProfile[]> {
  const rows = await prisma.brandingProfile.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return rows.map(toProfile);
}

export async function getProfile(id: string): Promise<BrandingProfile> {
  const row = await prisma.brandingProfile.findUnique({ where: { id } });
  if (!row) throw new NotFoundError('BrandingProfile', id);
  return toProfile(row);
}

export async function getDefaultProfile(): Promise<BrandingProfile | null> {
  const row = await prisma.brandingProfile.findFirst({ where: { isDefault: true } });
  return row ? toProfile(row) : null;
}

export async function createProfile(input: Partial<BrandingProfileInput>): Promise<BrandingProfile> {
  const merged = withDefaults(input);
  const issues = validateProfileInput(merged);
  if (issues.length > 0) {
    throw new ValidationError('Invalid branding profile.', issues);
  }

  const existing = await prisma.brandingProfile.findUnique({ where: { name: merged.name } });
  if (existing) throw new ConflictError(`A profile named "${merged.name}" already exists.`);

  // Only one default at a time.
  if (merged.isDefault) {
    await prisma.brandingProfile.updateMany({ data: { isDefault: false }, where: {} });
  }

  const row = await prisma.brandingProfile.create({
    data: {
      name: merged.name,
      companyName: merged.companyName,
      productName: merged.productName,
      supportText: merged.supportText,
      website: merged.website,
      footerText: merged.footerText,
      primaryColor: merged.primaryColor,
      secondaryColor: merged.secondaryColor,
      loginTitle: merged.loginTitle,
      dashboardTitle: merged.dashboardTitle,
      logoPath: merged.logoPath,
      faviconPath: merged.faviconPath,
      isDefault: merged.isDefault ?? false,
    },
  });
  return toProfile(row);
}

export async function updateProfile(
  id: string,
  input: Partial<BrandingProfileInput>,
): Promise<BrandingProfile> {
  const existing = await prisma.brandingProfile.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('BrandingProfile', id);

  const merged = { ...toProfile(existing), ...input } as BrandingProfileInput;
  const issues = validateProfileInput(merged);
  if (issues.length > 0) throw new ValidationError('Invalid branding profile.', issues);

  if (input.isDefault) {
    await prisma.brandingProfile.updateMany({
      data: { isDefault: false },
      where: { NOT: { id } },
    });
  }

  const row = await prisma.brandingProfile.update({
    where: { id },
    data: {
      name: merged.name,
      companyName: merged.companyName,
      productName: merged.productName,
      supportText: merged.supportText,
      website: merged.website,
      footerText: merged.footerText,
      primaryColor: merged.primaryColor,
      secondaryColor: merged.secondaryColor,
      loginTitle: merged.loginTitle,
      dashboardTitle: merged.dashboardTitle,
      logoPath: merged.logoPath,
      faviconPath: merged.faviconPath,
      isDefault: input.isDefault ?? existing.isDefault,
    },
  });
  return toProfile(row);
}

export async function deleteProfile(id: string): Promise<void> {
  const existing = await prisma.brandingProfile.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('BrandingProfile', id);
  if (existing.isDefault) {
    throw new ConflictError('Cannot delete the default profile. Set another default first.');
  }
  await prisma.brandingProfile.delete({ where: { id } });
}

/** Write a profile to <storage>/profiles/<name>.json and return the path. */
export async function exportProfileJson(id: string): Promise<string> {
  const profile = await getProfile(id);
  const safeName = profile.name.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
  const filePath = path.join(config.profilesDir, `${safeName}.json`);
  await saveProfileToFile(profile, filePath);
  return filePath;
}

/** Attach an uploaded logo/favicon path to a profile. */
export async function setProfileAsset(
  id: string,
  kind: 'logo' | 'favicon',
  storedPath: string,
): Promise<BrandingProfile> {
  const existing = await prisma.brandingProfile.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('BrandingProfile', id);
  const row = await prisma.brandingProfile.update({
    where: { id },
    data: kind === 'logo' ? { logoPath: storedPath } : { faviconPath: storedPath },
  });
  return toProfile(row);
}

/**
 * Read a profile's stored logo/favicon bytes for preview. Reads are confined to
 * the profiles storage directory as a defence against path traversal.
 */
export async function readProfileAssetBytes(
  id: string,
  kind: 'logo' | 'favicon',
): Promise<{ bytes: Buffer; ext: string }> {
  const profile = await getProfile(id);
  const stored = kind === 'logo' ? profile.logoPath : profile.faviconPath;
  if (!stored) throw new NotFoundError(`${kind} for profile`, id);

  const resolved = path.resolve(stored);
  const profilesRoot = path.resolve(config.profilesDir);
  if (!resolved.startsWith(profilesRoot)) {
    throw new ValidationError('Asset path escapes the profiles directory; refusing to read.');
  }
  const bytes = await fs.readFile(resolved);
  return { bytes, ext: path.extname(resolved).toLowerCase() };
}
