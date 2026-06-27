/** Branding profile load/save/validation helpers. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_NDTECH_PROFILE,
  type BrandingProfile,
  type BrandingProfileInput,
} from '@ndtech/shared';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface ValidationIssue {
  field: keyof BrandingProfileInput;
  message: string;
}

/** Validate a branding profile input, returning a list of issues (empty = ok). */
export function validateProfileInput(input: Partial<BrandingProfileInput>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required: (keyof BrandingProfileInput)[] = [
    'name',
    'companyName',
    'productName',
    'footerText',
    'website',
    'loginTitle',
    'dashboardTitle',
  ];
  for (const field of required) {
    const value = input[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      issues.push({ field, message: `"${String(field)}" is required.` });
    }
  }
  if (input.primaryColor && !HEX_COLOR.test(input.primaryColor)) {
    issues.push({ field: 'primaryColor', message: 'primaryColor must be a hex color (e.g. #1e66f5).' });
  }
  if (input.secondaryColor && !HEX_COLOR.test(input.secondaryColor)) {
    issues.push({ field: 'secondaryColor', message: 'secondaryColor must be a hex color.' });
  }
  if (input.website && !/^https?:\/\//i.test(input.website)) {
    issues.push({ field: 'website', message: 'website must start with http:// or https://' });
  }
  return issues;
}

/** Merge user input over the NDTECH defaults to produce a complete input object. */
export function withDefaults(input: Partial<BrandingProfileInput>): BrandingProfileInput {
  return { ...DEFAULT_NDTECH_PROFILE, ...input };
}

export async function loadProfileFromFile(filePath: string): Promise<BrandingProfileInput> {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<BrandingProfileInput>;
  const merged = withDefaults(parsed);
  const issues = validateProfileInput(merged);
  if (issues.length > 0) {
    throw new Error(
      `Invalid branding profile "${filePath}":\n` +
        issues.map((i) => `  - ${i.message}`).join('\n'),
    );
  }
  return merged;
}

export async function saveProfileToFile(
  profile: BrandingProfile | BrandingProfileInput,
  filePath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf8');
}
