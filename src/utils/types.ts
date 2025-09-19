/**
 * Type definitions for Admiral homelab configurations
 */

// Enums for type safety
export enum HomelabType {
  LOCAL = "local",
  BASIC_CLOUD = "basic-cloud",
  ADVANCED_CLOUD = "advanced-cloud",
}

export enum Environment {
  DEV = "dev",
  STAGE = "stage",
  PROD = "prod",
}

export enum ComputePattern {
  FARGATE_ONLY = "fargate-only",
  MANAGED_NODES = "managed-nodes",
  MIXED = "mixed",
  WINDOWS = "windows",
}

export enum NetworkPattern {
  PUBLIC_ONLY = "public-only",
  PRIVATE_NAT = "private-nat",
  VPC_ENDPOINTS = "vpc-endpoints",
}

export enum CapacityType {
  ON_DEMAND = "ON_DEMAND",
  SPOT = "SPOT",
}

export enum TaintEffect {
  NO_SCHEDULE = "NO_SCHEDULE",
  PREFER_NO_SCHEDULE = "PREFER_NO_SCHEDULE",
  NO_EXECUTE = "NO_EXECUTE",
}

export enum GitOpsType {
  FLUX = "flux",
  ARGOCD = "argocd",
  NONE = "none",
}

export enum ServiceMeshType {
  LINKERD = "linkerd",
  ISTIO = "istio",
  NONE = "none",
}

export interface HomelabConfig {
  name: string;
  type: HomelabType;
  account: string;
  region: string;

  network: NetworkConfig;
  compute: ComputeConfig;
  addons: AddonConfig;
  costControls: CostControlConfig;
  eksVersion: string;
}

export interface NetworkConfig {
  pattern: NetworkPattern;
  azCount: number;
  enableFlowLogs: boolean;
  vpcCidr: string;
}

export interface ComputeConfig {
  pattern: ComputePattern;
  nodeGroups: NodeGroupConfig[];
  fargateProfiles: FargateProfileConfig[];
}

export interface NodeGroupConfig {
  name: string;
  instanceTypes: string[];
  capacityType: CapacityType;
  desired: number;
  min: number;
  max: number;
  labels?: Record<string, string>;
  taints?: NodeTaint[];
}

export interface NodeTaint {
  key: string;
  value: string;
  effect: TaintEffect;
}

export interface FargateProfileConfig {
  name: string;
  selectors: FargateSelector[];
}

export interface FargateSelector {
  namespace: string;
  labels?: Record<string, string>;
}

export interface AddonConfig {
  gitops: GitOpsType;
  mesh: ServiceMeshType;
  albController: boolean;
  certManager: boolean;
  observability: boolean;
  ebs: boolean;
  efs: boolean;
}

export interface CostControlConfig {
  autoShutdown: boolean;
  ttlHours: number;
  budgetAlerts: boolean;
  tags: Record<string, string>;
}

export enum KubernetesDistribution {
  K3S = "k3s",
  KIND = "kind",
}

export enum PortProtocol {
  TCP = "tcp",
  UDP = "udp",
}

export interface LocalHomelabConfig {
  name: string;
  type: HomelabType.LOCAL;

  vms: {
    count: number;
    cpus: number;
    memory: number; // MB
    disk: number; // GB
  };

  kubernetes: {
    distribution: KubernetesDistribution;
    version: string;
    features: {
      ingress: boolean;
      monitoring: boolean;
      storage: boolean;
    };
  };

  network: {
    subnet: string;
    portForwarding: PortForwardConfig[];
  };

  tools: {
    docker: boolean;
    helm: boolean;
    kubectl: boolean;
    monitoring: boolean;
  };
}

export interface PortForwardConfig {
  name: string;
  hostPort: number;
  guestPort: number;
  protocol: PortProtocol;
}
