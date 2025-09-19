import { Construct } from 'constructs';
import {
    FargateProfileConfig,
    generateResourceName,
    generateStandardTags,
    NodeGroupConfig
} from '../utils';

export interface EKSBuilderProps {
    /**
     * Compute pattern to use
     */
    computePattern: ComputePattern;

    /**
     * VPC for the EKS cluster
     */
    vpc: IVpc;

    /**
     * Kubernetes version
     */
    version: KubernetesVersion;

    /**
     * Environment name
     */
    environment: Environment;

    /**
     * Homelab type
     */
    homelabType: HomelabType;

    /**
     * Node group configurations
     */
    nodeGroupConfigs: NodeGroupConfig[];

    /**
     * Fargate profile configurations
     */
    fargateProfiles: FargateProfileConfig[];

    /**
     * Managed addon configurations
     */
    managedAddons?: ManagedAddonConfig[];

    /**
     * Additional tags
     */
    additionalTags?: Record<string, string>;

    /**
     * Enable private API endpoint only
     */
    privateEndpoint?: boolean;

    /**
     * Enable cluster logging
     */
    enableLogging?: boolean;
}

export interface ManagedAddonConfig {
    addonName: string;
    addonVersion?: string;
    resolveConflicts?: ResolveConflicts;
    serviceAccountRoleArn?: string;
}

export interface EKSBuilderOutput {
    cluster: Cluster;
    nodeGroups: Nodegroup[];
    fargateProfiles: FargateProfile[];
    managedAddons: CfnAddon[];
    clusterSecurityGroup: SecurityGroup;
    nodeSecurityGroup?: SecurityGroup;
}

/**
 * EKSBuilder construct for creating flexible EKS cluster configurations
 */
export class EKSBuilder extends Construct {
    public readonly output: EKSBuilderOutput;

    constructor(scope: Construct, id: string, props: EKSBuilderProps) {
        super(scope, id);

        // Validate props
        this.validateProps(props);

        // Generate resource names and tags
        const clusterName = generateResourceName('admiral', props.environment, 'cluster');
        const tags = generateStandardTags(props.environment, props.homelabType, props.additionalTags);

        // Create cluster security group
        const clusterSecurityGroup = this.createClusterSecurityGroup(props.vpc, props.environment);

        // Create EKS cluster
        const cluster = new Cluster(this, 'Cluster', {
            clusterName,
            version: props.version,
            vpc: props.vpc,
            defaultCapacity: 0, // We'll manage capacity separately
            securityGroup: clusterSecurityGroup,
            endpointAccess: this.getEndpointAccess(props),
            clusterLogging: props.enableLogging ? this.getClusterLogging() : undefined,
            tags,
        });

        // Create node security group if needed
        let nodeSecurityGroup: ec2.SecurityGroup | undefined;
        if (this.needsNodeSecurityGroup(props.computePattern)) {
            nodeSecurityGroup = this.createNodeSecurityGroup(props.vpc, clusterSecurityGroup, props.environment);
        }

        // Create Fargate profiles
        const fargateProfiles = this.createFargateProfiles(cluster, props);

        // Create node groups
        const nodeGroups = this.createNodeGroups(cluster, props, nodeSecurityGroup);

        // Create managed addons
        const managedAddons = this.createManagedAddons(cluster, props);

        // Prepare output
        this.output = {
            cluster,
            nodeGroups,
            fargateProfiles,
            managedAddons,
            clusterSecurityGroup,
            nodeSecurityGroup,
        };
    }

    private validateProps(props: EKSBuilderProps): void {
        const validPatterns = Object.values(ComputePattern);
        if (!validPatterns.includes(props.computePattern)) {
            throw new Error(`Invalid compute pattern. Must be one of: ${validPatterns.join(', ')}`);
        }

        if (props.computePattern === ComputePattern.FARGATE_ONLY && props.nodeGroupConfigs.length > 0) {
            throw new Error('Fargate-only pattern cannot have node group configurations');
        }

        if (props.computePattern === ComputePattern.MANAGED_NODES && props.fargateProfiles.length > 0) {
            throw new Error('Managed-nodes pattern cannot have Fargate profile configurations');
        }

        if (props.computePattern === ComputePattern.WINDOWS && props.fargateProfiles.length > 0) {
            throw new Error('Windows pattern does not support Fargate profiles');
        }
    }

    private getEndpointAccess(props: EKSBuilderProps): EndpointAccess {
        if (props.privateEndpoint) {
            return EndpointAccess.PRIVATE;
        }
        return EndpointAccess.PUBLIC_AND_PRIVATE;
    }

    private getClusterLogging(): ClusterLoggingTypes[] {
        return [
            ClusterLoggingTypes.API,
            ClusterLoggingTypes.AUDIT,
            ClusterLoggingTypes.AUTHENTICATOR,
            ClusterLoggingTypes.CONTROLLER_MANAGER,
            ClusterLoggingTypes.SCHEDULER,
        ];
    }

    private needsNodeSecurityGroup(pattern: ComputePattern): boolean {
        return pattern !== ComputePattern.FARGATE_ONLY;
    }

    private createClusterSecurityGroup(vpc: IVpc, environment: Environment): SecurityGroup {
        const sgName = generateResourceName('admiral', environment, 'cluster-sg');

        const securityGroup = new SecurityGroup(this, 'ClusterSecurityGroup', {
            vpc,
            description: 'Security group for EKS cluster control plane',
            securityGroupName: sgName,
        });

        // Allow HTTPS traffic for EKS API server
        securityGroup.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(443),
            'Allow HTTPS access to EKS API server'
        );

        return securityGroup;
    }

    private createNodeSecurityGroup(
        vpc: IVpc,
        clusterSecurityGroup: SecurityGroup,
        environment: Environment
    ): SecurityGroup {
        const sgName = generateResourceName('admiral', environment, 'node-sg');

        const securityGroup = new SecurityGroup(this, 'NodeSecurityGroup', {
            vpc,
            description: 'Security group for EKS worker nodes',
            securityGroupName: sgName,
        });

        // Allow all traffic between nodes
        securityGroup.addIngressRule(
            securityGroup,
            Port.allTraffic(),
            'Allow all traffic between worker nodes'
        );

        // Allow traffic from cluster security group
        securityGroup.addIngressRule(
            clusterSecurityGroup,
            Port.allTraffic(),
            'Allow traffic from EKS cluster control plane'
        );

        // Allow cluster to communicate with nodes
        clusterSecurityGroup.addEgressRule(
            securityGroup,
            Port.allTraffic(),
            'Allow cluster to communicate with worker nodes'
        );

        return securityGroup;
    }

    private createFargateProfiles(cluster: eks.Cluster, props: EKSBuilderProps): eks.FargateProfile[] {
        const profiles: eks.FargateProfile[] = [];

        props.fargateProfiles.forEach((profileConfig, index) => {
            const profileName = generateResourceName('admiral', props.environment, `fargate-${profileConfig.name}`);

            const profile = cluster.addFargateProfile(`FargateProfile${index}`, {
                fargateProfileName: profileName,
                selectors: profileConfig.selectors.map(selector => ({
                    namespace: selector.namespace,
                    labels: selector.labels,
                })),
            });

            profiles.push(profile);
        });

        return profiles;
    }

    private createNodeGroups(
        cluster: eks.Cluster,
        props: EKSBuilderProps,
        nodeSecurityGroup?: ec2.SecurityGroup
    ): eks.Nodegroup[] {
        const nodeGroups: eks.Nodegroup[] = [];

        props.nodeGroupConfigs.forEach((nodeGroupConfig, index) => {
            const nodeGroupName = generateResourceName('admiral', props.environment, `ng-${nodeGroupConfig.name}`);

            // Create launch template for the node group
            const launchTemplate = this.createLaunchTemplate(nodeGroupConfig, props, index);

            const nodeGroup = cluster.addNodegroupCapacity(`NodeGroup${index}`, {
                nodegroupName: nodeGroupName,
                instanceTypes: nodeGroupConfig.instanceTypes.map(type => new ec2.InstanceType(type)),
                capacityType: nodeGroupConfig.capacityType === 'SPOT' ?
                    eks.CapacityType.SPOT : eks.CapacityType.ON_DEMAND,
                desiredSize: nodeGroupConfig.desired,
                minSize: nodeGroupConfig.min,
                maxSize: nodeGroupConfig.max,
                labels: nodeGroupConfig.labels,
                taints: nodeGroupConfig.taints?.map(taint => ({
                    key: taint.key,
                    value: taint.value,
                    effect: this.mapTaintEffect(taint.effect),
                })),
                launchTemplateSpec: {
                    id: launchTemplate.launchTemplateId!,
                    version: launchTemplate.latestVersionNumber,
                },
                subnets: {
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            });

            nodeGroups.push(nodeGroup);
        });

        return nodeGroups;
    }

    private createLaunchTemplate(
        nodeGroupConfig: NodeGroupConfig,
        props: EKSBuilderProps,
        index: number
    ): ec2.LaunchTemplate {
        const templateName = generateResourceName('admiral', props.environment, `lt-${nodeGroupConfig.name}`);

        // Determine AMI type based on compute pattern
        const amiType = props.computePattern === 'windows' ?
            eks.NodegroupAmiType.WINDOWS_CORE_2019_X86_64 :
            eks.NodegroupAmiType.AL2_X86_64;

        return new ec2.LaunchTemplate(this, `LaunchTemplate${index}`, {
            launchTemplateName: templateName,
            machineImage: eks.EksOptimizedImage.of({
                nodeType: props.computePattern === 'windows' ?
                    eks.NodeType.WINDOWS : eks.NodeType.STANDARD,
                kubernetesVersion: props.version.version,
            }),
            userData: ec2.UserData.forLinux(), // Will be overridden by EKS
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: ec2.BlockDeviceVolume.ebs(20, {
                        volumeType: ec2.EbsDeviceVolumeType.GP3,
                        encrypted: true,
                    }),
                },
            ],
        });
    }

    private mapTaintEffect(effect: TaintEffect): EksTaintEffect {
        switch (effect) {
            case TaintEffect.NO_SCHEDULE:
                return EksTaintEffect.NO_SCHEDULE;
            case TaintEffect.PREFER_NO_SCHEDULE:
                return EksTaintEffect.PREFER_NO_SCHEDULE;
            case TaintEffect.NO_EXECUTE:
                return EksTaintEffect.NO_EXECUTE;
            default:
                throw new Error(`Invalid taint effect: ${effect}`);
        }
    }

    private createManagedAddons(cluster: eks.Cluster, props: EKSBuilderProps): eks.CfnAddon[] {
        const addons: eks.CfnAddon[] = [];

        // Default managed addons for all clusters
        const defaultAddons: ManagedAddonConfig[] = [
            { addonName: 'vpc-cni' },
            { addonName: 'coredns' },
            { addonName: 'kube-proxy' },
        ];

        // Add EBS CSI driver for non-Fargate clusters
        if (props.computePattern !== 'fargate-only') {
            defaultAddons.push({ addonName: 'aws-ebs-csi-driver' });
        }

        // Combine default and custom addons
        const allAddons = [...defaultAddons, ...(props.managedAddons || [])];

        allAddons.forEach((addonConfig, index) => {
            const addon = new eks.CfnAddon(this, `ManagedAddon${index}`, {
                clusterName: cluster.clusterName,
                addonName: addonConfig.addonName,
                addonVersion: addonConfig.addonVersion,
                resolveConflicts: addonConfig.resolveConflicts || eks.ResolveConflicts.OVERWRITE,
                serviceAccountRoleArn: addonConfig.serviceAccountRoleArn,
            });

            // Ensure addon is created after cluster
            addon.node.addDependency(cluster);

            addons.push(addon);
        });

        return addons;
    }

    /**
     * Create IAM role for service accounts (IRSA)
     */
    public createServiceAccountRole(
        serviceAccountName: string,
        namespace: string,
        policyStatements: iam.PolicyStatement[]
    ): iam.Role {
        const roleName = generateResourceName('admiral', 'irsa', `${namespace}-${serviceAccountName}`);

        const role = new iam.Role(this, `ServiceAccountRole-${namespace}-${serviceAccountName}`, {
            roleName,
            assumedBy: new iam.WebIdentityPrincipal(
                this.output.cluster.openIdConnectProvider.openIdConnectProviderArn,
                {
                    StringEquals: {
                        [`${this.output.cluster.clusterOpenIdConnectIssuer}:sub`]:
                            `system:serviceaccount:${namespace}:${serviceAccountName}`,
                        [`${this.output.cluster.clusterOpenIdConnectIssuer}:aud`]: 'sts.amazonaws.com',
                    },
                }
            ),
            inlinePolicies: {
                ServiceAccountPolicy: new iam.PolicyDocument({
                    statements: policyStatements,
                }),
            },
        });

        return role;
    }

    /**
     * Add Kubernetes manifest to the cluster
     */
    public addManifest(id: string, manifest: Record<string, any>): eks.KubernetesManifest {
        return this.output.cluster.addManifest(id, manifest);
    }

    /**
     * Add Helm chart to the cluster
     */
    public addHelmChart(id: string, options: eks.HelmChartOptions): eks.HelmChart {
        return this.output.cluster.addHelmChart(id, options);
    }
}