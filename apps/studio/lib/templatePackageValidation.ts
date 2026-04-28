"use client";

export interface TemplatePackageValidationResult {
  ok: boolean;
  errors: string[];
}

const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateTemplatePackage(
  value: unknown,
): TemplatePackageValidationResult {
  const errors: string[] = [];

  if (!isObject(value)) {
    return { ok: false, errors: ["Template package must be a JSON object."] };
  }

  if (value.schema_version !== "1") {
    errors.push('`schema_version` must be `"1"`.');
  }

  const name = value.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    errors.push("`name` is required.");
  } else if (name.length > 256) {
    errors.push("`name` must be 256 characters or fewer.");
  }

  const description = value.description;
  if (description != null && typeof description !== "string") {
    errors.push("`description` must be a string.");
  } else if (typeof description === "string" && description.length > 8000) {
    errors.push("`description` must be 8000 characters or fewer.");
  }

  const category = value.category;
  if (category != null && typeof category !== "string") {
    errors.push("`category` must be a string.");
  } else if (typeof category === "string" && category.length > 128) {
    errors.push("`category` must be 128 characters or fewer.");
  }

  const chainCompatibility = value.chain_compatibility;
  if (
    chainCompatibility != null &&
    (!Array.isArray(chainCompatibility) ||
      chainCompatibility.some((item) => typeof item !== "string"))
  ) {
    errors.push("`chain_compatibility` must be an array of strings.");
  }

  const files = value.files;
  if (files != null) {
    if (!Array.isArray(files)) {
      errors.push("`files` must be an array.");
    } else if (files.length > 200) {
      errors.push("`files` must contain at most 200 entries.");
    } else {
      files.forEach((file, index) => {
        if (!isObject(file)) {
          errors.push(`files[${index}] must be an object.`);
          return;
        }
        if (typeof file.path !== "string" || file.path.trim().length === 0) {
          errors.push(`files[${index}].path is required.`);
        } else if (file.path.length > 512) {
          errors.push(`files[${index}].path must be 512 characters or fewer.`);
        }
        if (typeof file.content !== "string") {
          errors.push(`files[${index}].content must be a string.`);
        } else if (file.content.length > 1_500_000) {
          errors.push(
            `files[${index}].content must be 1500000 characters or fewer.`,
          );
        }
        if (
          file.language != null &&
          (typeof file.language !== "string" || file.language.length > 64)
        ) {
          errors.push(
            `files[${index}].language must be a string no longer than 64 characters.`,
          );
        }
      });
    }
  }

  if (
    value.contract_code != null &&
    typeof value.contract_code !== "string" &&
    value.contract_code !== null
  ) {
    errors.push("`contract_code` must be a string or null.");
  } else if (
    typeof value.contract_code === "string" &&
    value.contract_code.length > 2_000_000
  ) {
    errors.push("`contract_code` must be 2000000 characters or fewer.");
  }

  for (const field of ["frontend_scaffold", "tests", "metadata"] as const) {
    if (value[field] != null && !isObject(value[field])) {
      errors.push(`\`${field}\` must be an object.`);
    }
  }

  if (
    value.version != null &&
    (!Number.isInteger(value.version) || Number(value.version) < 1)
  ) {
    errors.push("`version` must be an integer greater than or equal to 1.");
  }

  for (const field of ["createdAt", "updatedAt"] as const) {
    if (value[field] != null && typeof value[field] !== "string") {
      errors.push(`\`${field}\` must be a string.`);
    }
  }

  try {
    const bytes = new TextEncoder().encode(
      JSON.stringify(value, Object.keys(value).sort()),
    ).length;
    if (bytes > MAX_PACKAGE_BYTES) {
      errors.push(
        `Template package must be ${MAX_PACKAGE_BYTES} bytes or smaller.`,
      );
    }
  } catch {
    errors.push(
      "Template package could not be serialized for size validation.",
    );
  }

  return { ok: errors.length === 0, errors };
}
