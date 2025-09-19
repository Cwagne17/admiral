import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { generateResourceName, generateStandardTags } from '../utils';
import { VPCBuilderOutput } from './vpc-builder';

export interface EKSBuilderProps {
  /**
   * Compute pattern to use
   */
  computePattern: 'fargate-only' | 'managed-nodes' | 'mixed' | 'windows';

  /**
   * VPC configuration from VPCBuilder
   */
  vpcConfig: VPCBuilderOutput;

  /**
   * EKS cluster version
   */
  version: eks.KubernetesVersion;

  /**
   * Environment name
   */
  environment: string;

  /**
   * Homelab type
   */
  homelabType: string;

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
  managedAddons: ManagedAddonConfig[];

  /**
   * Additional tags
   */
  additionalTags?: Record<string, string>;
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
  subnets?: 'public' | 'private';
}

export interface NodeTaint {
  key: string;
  value: string;
  effect: 'NO_SCHEDULE' | 'PREFER_NO_SCHEDULE' | 'NO_EXECUTE';
}

export interface FargateProfileConfig {
  name: string;
  selectors: FargateSelector[];
  subnets?: 'private' | 'isolated';
}

export interface FargateSelector {
  namespace: string;
  labels?: Record<string, string>;
}

export interface ManagedAddonConfig {
  name: string;
  version?: string;
  configuration?: Record<string, any>;
}

export interface EKSBuilderOutput {
  cluster: eks.Cluster;
  nodeGroups: eks.Nodegroup[];
  fargateProfiles: eks.FargateProfile[];
  managedAddons: eks.CfnAddon[];
  clusterSecurityGroup: ec2.SecurityGroup;
  nodeSecurityGroup?: ec2.SecurityGroup;
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

    // Create cluster service role
    const clusterRole = this.createClusterServiceRole(props);

    // Create cluster security group
    const clusterSecurityGroup = this.createClusterSecurityGroup(props);

    // Create EKS cluster
    const cluster = new eks.Cluster(this, 'EKSCluster', {
      clusterName,
      version: props.version,
      vpc: props.vpcConfig.vpc,
      defaultCapacity: 0, // We'll manage capacity separately
      endpointAccess: this.getEndpointAccess(props),
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUDIT,
        eks.ClusterLoggingTypes.AUTHENTICATOR,
        eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
        eks.ClusterLoggingTypes.SCHEDULER,
      ],
      // kubectlLayer will be created automatically by CDK
    });

    // Create node security group if needed
    let nodeSecurityGroup: ec2.SecurityGroup | undefined;
    if (this.needsNodeGroups(props.computePattern)) {
      nodeSecurityGroup = this.createNodeSecurityGroup(props, cluster);
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
    const validPatterns = ['fargate-only', 'managed-nodes', 'mixed', 'windows'];
    if (!validPatterns.includes(props.computePattern)) {
      throw new Error(`Invalid compute pattern. Must be one of: ${validPatterns.join(', ')}`);
    }

    if (props.computePattern === 'fargate-only' && props.nodeGroupConfigs.length > 0) {
      throw new Error('Fargate-only pattern cannot have node group configurations');
    }

    if (props.computePattern === 'managed-nodes' && props.fargateProfiles.length > 0) {
      throw new Error('Managed-nodes pattern cannot have Fargate profile configurations');
    }

    // Validate node group configurations
    props.nodeGroupConfigs.forEach((config, index) => {
      if (config.min > config.desired || config.desired > config.max) {
        throw new Error(`Invalid capacity configuration for node group ${index}: min <= desired <= max`);
      }

      if (config.instanceTypes.length === 0) {
        throw new Error(`Node group ${index} must have at least one instance type`);
      }
    });

    // Validate Fargate profiles
    props.fargateProfiles.forEach((profile, index) => {
      if (profile.selectors.length === 0) {
        throw new Error(`Fargate profile ${index} must have at least one selector`);
      }
    });
  }

  private createClusterServiceRole(props: EKSBuilderProps): iam.Role {
    const roleName = generateResourceName('admiral', props.environment, 'cluster-role');

    return new iam.Role(this, 'ClusterServiceRole', {
      roleName,
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
      ],
    });
  }

  private createClusterSecurityGroup(props: EKSBuilderProps): ec2.SecurityGroup {
    const sgName = generateResourceName('admiral', props.environment, 'cluster-sg');

    const securityGroup = new ec2.SecurityGroup(this, 'ClusterSecurityGroup', {
      vpc: props.vpcConfig.vpc,
      description: 'Security group for EKS cluster control plane',
      securityGroupName: sgName,
    });

    // Allow HTTPS traffic for EKS API server
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS access to EKS API server'
    );

    return securityGroup;
  }

  private createNodeSecurityGroup(props: EKSBuilderProps, cluster: eks.Cluster): ec2.SecurityGroup {
    const sgName = generateResourceName('admiral', props.environment, 'node-sg');

    const securityGroup = new ec2.SecurityGroup(this, 'NodeSecurityGroup', {
      vpc: props.vpcConfig.vpc,
      description: 'Security group for EKS worker nodes',
      securityGroupName: sgName,
    });

    // Allow all traffic between nodes
    securityGroup.addIngressRule(
      securityGroup,
      ec2.Port.allTraffic(),
      'Allow all traffic between worker nodes'
    );

    // Allow traffic from cluster security group
    securityGroup.addIngressRule(
      cluster.clusterSecurityGroup,
      ec2.Port.allTraffic(),
      'Allow traffic from EKS cluster'
    );

    // Allow cluster to communicate with nodes
    cluster.clusterSecurityGroup.addEgressRule(
      securityGroup,
      ec2.Port.allTraffic(),
      'Allow cluster to communicate with nodes'
    );

    return securityGroup;
  }

  private getEndpointAccess(props: EKSBuilderProps): eks.EndpointAccess {
    // For homelab use, we'll use public and private access for flexibility
    // In production, you might want private-only
    return eks.EndpointAccess.PUBLIC_AND_PRIVATE;
  }

  private needsNodeGroups(computePattern: string): boolean {
    return computePattern !== 'fargate-only';
  }

  private createFargateProfiles(cluster: eks.Cluster, props: EKSBuilderProps): eks.FargateProfile[] {
    const profiles: eks.FargateProfile[] = [];

    props.fargateProfiles.forEach((profileConfig) => {
      const profileName = generateResourceName('admiral', props.environment, `fargate-${profileConfig.name}`);

      // Determine subnets for Fargate
      let subnets: ec2.ISubnet[];
      if (profileConfig.subnets === 'isolated') {
        subnets = props.vpcConfig.isolatedSubnets;
      } else {
        // Default to private subnets, fallback to isolated if no private subnets
        subnets = props.vpcConfig.privateSubnets.length > 0
          ? props.vpcConfig.privateSubnets
          : props.vpcConfig.isolatedSubnets;
      }

      const profile = cluster.addFargateProfile(profileConfig.name, {
        fargateProfileName: profileName,
        selectors: profileConfig.selectors.map(selector => ({
          namespace: selector.namespace,
          labels: selector.labels,
        })),
        subnetSelection: {
          subnets,
        },
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

    if (!this.needsNodeGroups(props.computePattern)) {
      return nodeGroups;
    }

    props.nodeGroupConfigs.forEach((nodeConfig) => {
      const nodeGroupName = generateResourceName('admiral', props.environment, `ng-${nodeConfig.name}`);

      // Determine subnets for node group
      let subnets: ec2.ISubnet[];
      if (nodeConfig.subnets === 'public') {
        subnets = props.vpcConfig.publicSubnets;
      } else {
        // Default to private subnets, fallback to public if no private subnets
        subnets = props.vpcConfig.privateSubnets.length > 0
          ? props.vpcConfig.privateSubnets
          : props.vpcConfig.publicSubnets;
      }

      // Create launch template for advanced configuration
      const launchTemplate = this.createLaunchTemplate(nodeConfig, props, nodeSecurityGroup);

      const nodeGroup = cluster.addNodegroupCapacity(nodeConfig.name, {
        nodegroupName: nodeGroupName,
        instanceTypes: nodeConfig.instanceTypes.map(type => new ec2.InstanceType(type)),
        capacityType: nodeConfig.capacityType === 'SPOT'
          ? eks.CapacityType.SPOT
          : eks.CapacityType.ON_DEMAND,
        desiredSize: nodeConfig.desired,
        minSize: nodeConfig.min,
        maxSize: nodeConfig.max,
        subnets: {
          subnets,
        },
        launchTemplateSpec: launchTemplate ? {
          id: launchTemplate.launchTemplateId!,
          version: launchTemplate.latestVersionNumber,
        } : undefined,
        labels: nodeConfig.labels,
        taints: nodeConfig.taints?.map(taint => ({
          key: taint.key,
          value: taint.value,
          effect: this.mapTaintEffect(taint.effect),
        })),
      });

      nodeGroups.push(nodeGroup);
    });

    return nodeGroups;
  }

  private createLaunchTemplate(
    nodeConfig: NodeGroupConfig,
    props: EKSBuilderProps,
    nodeSecurityGroup?: ec2.SecurityGroup
  ): ec2.LaunchTemplate | undefined {
    // Only create launch template if we have specific requirements
    if (!nodeSecurityGroup && !nodeConfig.labels && !nodeConfig.taints) {
      return undefined;
    }

    const templateName = generateResourceName('admiral', props.environment, `lt-${nodeConfig.name}`);

    return new ec2.LaunchTemplate(this, `LaunchTemplate-${nodeConfig.name}`, {
      launchTemplateName: templateName,
      securityGroup: nodeSecurityGroup,
      userData: ec2.UserData.forLinux(), // EKS-optimized AMI will handle the rest
    });
  }

  private mapTaintEffect(effect: string): eks.TaintEffect {
    switch (effect) {
      case 'NO_SCHEDULE':
        return eks.TaintEffect.NO_SCHEDULE;
      case 'PREFER_NO_SCHEDULE':
        return eks.TaintEffect.PREFER_NO_SCHEDULE;
      case 'NO_EXECUTE':
        return eks.TaintEffect.NO_EXECUTE;
      default:
        throw new Error(`Invalid taint effect: ${effect}`);
    }
  }

  private createManagedAddons(cluster: eks.Cluster, props: EKSBuilderProps): eks.CfnAddon[] {
    const addons: eks.CfnAddon[] = [];

    // Default managed addons for EKS
    const defaultAddons: ManagedAddonConfig[] = [
      { name: 'vpc-cni', version: 'latest' },
      { name: 'coredns', version: 'latest' },
      { name: 'kube-proxy', version: 'latest' },
    ];

    // Combine default and custom addons
    const allAddons = [...defaultAddons, ...props.managedAddons];

    allAddons.forEach((addonConfig) => {
      const addon = new eks.CfnAddon(this, `Addon-${addonConfig.name}`, {
        clusterName: cluster.clusterName,
        addonName: addonConfig.name,
        addonVersion: addonConfig.version === 'latest' ? undefined : addonConfig.version,
        configurationValues: addonConfig.configuration ? JSON.stringify(addonConfig.configuration) : undefined,
        resolveConflicts: 'OVERWRITE', // For homelab use, overwrite conflicts
      });

      // Ensure addon is created after cluster
      addon.node.addDependency(cluster);

      addons.push(addon);
    });

    return addons;
  }

  /**
   * Get the cluster's OIDC provider URL
   */
  public getOidcProviderUrl(): string {
    return this.output.cluster.clusterOpenIdConnectIssuerUrl;
  }

  /**
   * Create an OIDC provider for service account authentication
   */
  public createOidcProvider(): iam.OpenIdConnectProvider {
    return new iam.OpenIdConnectProvider(this, 'OidcProvider', {
      url: this.getOidcProviderUrl(),
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['9e99a48a9960b14926bb7f3b02e22da2b0ab7280'], // EKS OIDC root CA thumbprint
    });
  }

  /**
   * Create a service account with IAM role for IRSA (IAM Roles for Service Accounts)
   */
  public createServiceAccountWithRole(
    namespace: string,
    serviceAccountName: string,
    policyStatements: iam.PolicyStatement[]
  ): iam.Role {
    const oidcProvider = this.createOidcProvider();
    const roleName = generateResourceName('admiral', 'eks', `sa-${serviceAccountName}`);

    const role = new iam.Role(this, `ServiceAccountRole-${serviceAccountName}`, {
      roleName,
      assumedBy: new iam.FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            [`${this.getOidcProviderUrl().replace('https://', '')}:sub`]:
              `system:serviceaccount:${namespace}:${serviceAccountName}`,
            [`${this.getOidcProviderUrl().replace('https://', '')}:aud`]: 'sts.amazonaws.com',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // Add policy statements to the role
    policyStatements.forEach((statement, index) => {
      role.addToPolicy(statement);
    });

    return role;
  }
}