/**
 * AWS-specific utility functions
 */

/**
 * Generate resource name with consistent naming convention
 */
export function generateResourceName(
  prefix: string,
  environment: string,
  resourceType: string,
  suffix?: string,
): string {
  const parts = [prefix, environment, resourceType];
  if (suffix) {
    parts.push(suffix);
  }
  return parts.join("-").toLowerCase();
}

/**
 * Generate tags for AWS resources
 */
export function generateStandardTags(
  environment: string,
  homelabType: string,
  additionalTags: Record<string, string> = {},
): Record<string, string> {
  const standardTags = {
    Environment: environment,
    Project: "admiral",
    HomelabType: homelabType,
    ManagedBy: "cdk",
    CreatedBy: "admiral-homelab",
  };

  return { ...standardTags, ...additionalTags };
}

/**
 * Generate cost control tags
 */
export function generateCostControlTags(
  ttlHours?: number,
  costCenter?: string,
  owner?: string,
): Record<string, string> {
  const tags: Record<string, string> = {};

  if (ttlHours) {
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + ttlHours);
    tags.TTL = expirationDate.toISOString();
    tags.AutoShutdown = "true";
  }

  if (costCenter) {
    tags.CostCenter = costCenter;
  }

  if (owner) {
    tags.Owner = owner;
  }

  return tags;
}

/**
 * Get availability zones for a region (simplified mapping)
 */
export function getAvailabilityZones(
  region: string,
  count: number = 2,
): string[] {
  const azSuffixes = ["a", "b", "c", "d", "e", "f"];
  return azSuffixes.slice(0, count).map((suffix) => `${region}${suffix}`);
}

/**
 * Validate and format CIDR blocks
 */
export function validateCidrBlock(cidr: string): boolean {
  const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  return cidrPattern.test(cidr);
}

/**
 * Generate subnet CIDR blocks from VPC CIDR
 */
export function generateSubnetCidrs(
  vpcCidr: string,
  subnetCount: number,
  subnetSize: number = 24,
): string[] {
  if (!validateCidrBlock(vpcCidr)) {
    throw new Error(`Invalid VPC CIDR: ${vpcCidr}`);
  }

  const [baseIp, vpcMask] = vpcCidr.split("/");
  const vpcMaskNum = parseInt(vpcMask, 10);

  if (subnetSize <= vpcMaskNum) {
    throw new Error(
      `Subnet size /${subnetSize} must be larger than VPC mask /${vpcMaskNum}`,
    );
  }

  const baseIpParts = baseIp.split(".").map((part) => parseInt(part, 10));
  const subnets: string[] = [];

  for (let i = 0; i < subnetCount; i++) {
    const subnetIpParts = [...baseIpParts];
    subnetIpParts[2] = baseIpParts[2] + i;

    if (subnetIpParts[2] > 255) {
      throw new Error(`Cannot create ${subnetCount} subnets from ${vpcCidr}`);
    }

    const subnetIp = subnetIpParts.join(".");
    subnets.push(`${subnetIp}/${subnetSize}`);
  }

  return subnets;
}
