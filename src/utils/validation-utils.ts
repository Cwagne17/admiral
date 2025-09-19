/**
 * Validation utilities for homelab configurations
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate AWS account ID format
 */
export function validateAwsAccountId(accountId: string): boolean {
  return /^\d{12}$/.test(accountId);
}

/**
 * Validate AWS region format
 */
export function validateAwsRegion(region: string): boolean {
  const regionPattern = /^[a-z]{2}-[a-z]+-\d{1}$/;
  return regionPattern.test(region);
}

/**
 * Validate Kubernetes version format
 */
export function validateKubernetesVersion(version: string): boolean {
  const versionPattern = /^1\.\d{2}$/;
  return versionPattern.test(version);
}

/**
 * Validate homelab type
 */
export function validateHomelabType(type: string): boolean {
  const validTypes = ["local", "basic-cloud", "advanced-cloud"];
  return validTypes.includes(type);
}

/**
 * Validate configuration object against schema
 */
export function validateConfiguration(
  config: any,
  requiredFields: string[],
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Check required fields
  for (const field of requiredFields) {
    if (config[field] === undefined || config[field] === null) {
      result.errors.push(`Required field '${field}' is missing`);
      result.isValid = false;
    }
  }

  // Validate AWS account ID if present
  if (config.account && !validateAwsAccountId(config.account)) {
    result.errors.push("Invalid AWS account ID format. Must be 12 digits.");
    result.isValid = false;
  }

  // Validate AWS region if present
  if (config.region && !validateAwsRegion(config.region)) {
    result.errors.push("Invalid AWS region format. Example: us-east-1");
    result.isValid = false;
  }

  // Validate Kubernetes version if present
  if (config.eksVersion && !validateKubernetesVersion(config.eksVersion)) {
    result.errors.push("Invalid Kubernetes version format. Example: 1.30");
    result.isValid = false;
  }

  // Validate homelab type if present
  if (config.type && !validateHomelabType(config.type)) {
    result.errors.push(
      "Invalid homelab type. Must be: local, basic-cloud, or advanced-cloud",
    );
    result.isValid = false;
  }

  return result;
}

/**
 * Validate and throw error if configuration is invalid
 */
export function validateConfigurationOrThrow(
  config: any,
  requiredFields: string[],
): void {
  const result = validateConfiguration(config, requiredFields);

  if (!result.isValid) {
    const errorMessage = [
      "Configuration validation failed:",
      ...result.errors.map((error) => `  - ${error}`),
    ].join("\n");

    throw new Error(errorMessage);
  }

  // Log warnings if any
  if (result.warnings.length > 0) {
    console.warn("Configuration warnings:");
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }
}
