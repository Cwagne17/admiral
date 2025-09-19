/**
 * Type definitions for Admiral homelab configurations
 */

export interface HomelabConfig {
    name: string;
    type: 'local' | 'basic-cloud' | 'advanced-cloud';
    account: string;
    region: string;

    network: NetworkConfig;
    compute: ComputeConfig;
    addons: AddonConfig;
    costControls: CostControlConfig;
    eksVersion: string;
}

export interface NetworkConfig {
    pattern: 'public-only' | 'private-nat' | 'vpc-endpoints';
    azCount: number;
    enableFlowLogs: boolean;
    vpcCidr: string;
}

export interface ComputeConfig {
    pattern: 'fargate-only' | 'managed-nodes' | 'mixed' | 'windows';
    nodeGroups: NodeGroupConfig[];
    fargateProfiles: FargateProfileConfig[];
}

export interface NodeGroupConfig {
    name: string;
    instanceTypes: string[];
    capacityType: 'ON_DEMAND' | 'SPOT';
    desired: number;
    min: number;
    max: number;
    labels?: Record<string, string>;
    taints?: NodeTaint[];
}

export interface NodeTaint {
    key: string;
    value: string;
    effect: 'NO_SCHEDULE' | 'PREFER_NO_SCHEDULE' | 'NO_EXECUTE';
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
    gitops: 'flux' | 'argocd' | 'none';
    mesh: 'linkerd' | 'istio' | 'none';
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

export interface LocalHomelabConfig {
    name: string;
    type: 'local';

    vms: {
        count: number;
        cpus: number;
        memory: number; // MB
        disk: number;   // GB
    };

    kubernetes: {
        distribution: 'k3s' | 'kind';
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
    protocol: 'tcp' | 'udp';
}