import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as eks from 'aws-cdk-lib/aws-eks';
import { EKSBuilder } from '../../src/constructs/eks-builder';
import { VPCBuilder } from '../../src/constructs/vpc-builder';

describe('EKSBuilder', () => {
  let app: App;
  let stack: Stack;
  let vpcBuilder: VPCBuilder;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');

    // Create VPC for testing
    vpcBuilder = new VPCBuilder(stack, 'TestVPC', {
      pattern: 'private-nat',
      azCount: 2,
      vpcCidr: '10.0.0.0/16',
      environment: 'test',
      homelabType: 'basic-cloud',
      enableFlowLogs: false,
    });
  });

  describe('fargate-only pattern', () => {
    it('should create EKS cluster with Fargate profiles only', () => {
      // GIVEN
      const props = {
        computePattern: 'fargate-only' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [],
        fargateProfiles: [
          {
            name: 'system',
            selectors: [
              { namespace: 'kube-system' },
              { namespace: 'default' },
            ],
          },
        ],
        managedAddons: [],
      };

      // WHEN
      const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have EKS cluster
      template.hasResourceProperties('AWS::EKS::Cluster', {
        Name: 'admiral-test-cluster',
        Version: '1.30',
      });

      // Should have Fargate profile
      template.hasResourceProperties('AWS::EKS::FargateProfile', {
        FargateProfileName: 'admiral-test-fargate-system',
      });

      // Should not have node groups
      template.resourceCountIs('AWS::EKS::Nodegroup', 0);

      // Verify output
      expect(eksBuilder.output.cluster).toBeDefined();
      expect(eksBuilder.output.fargateProfiles).toHaveLength(1);
      expect(eksBuilder.output.nodeGroups).toHaveLength(0);
    });

    it('should create managed addons', () => {
      // GIVEN
      const props = {
        computePattern: 'fargate-only' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [],
        fargateProfiles: [
          {
            name: 'system',
            selectors: [{ namespace: 'kube-system' }],
          },
        ],
        managedAddons: [],
      };

      // WHEN
      new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have default managed addons
      template.hasResourceProperties('AWS::EKS::Addon', {
        AddonName: 'vpc-cni',
      });
      template.hasResourceProperties('AWS::EKS::Addon', {
        AddonName: 'coredns',
      });
      template.hasResourceProperties('AWS::EKS::Addon', {
        AddonName: 'kube-proxy',
      });
    });
  });

  describe('managed-nodes pattern', () => {
    it('should create EKS cluster with managed node groups', () => {
      // GIVEN
      const props = {
        computePattern: 'managed-nodes' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'general',
            instanceTypes: ['t3.medium'],
            capacityType: 'ON_DEMAND' as const,
            desired: 2,
            min: 1,
            max: 4,
            labels: { role: 'general' },
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN
      const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have EKS cluster
      template.hasResourceProperties('AWS::EKS::Cluster', {
        Name: 'admiral-test-cluster',
      });

      // Should have node group
      template.hasResourceProperties('AWS::EKS::Nodegroup', {
        NodegroupName: 'admiral-test-ng-general',
        CapacityType: 'ON_DEMAND',
        ScalingConfig: {
          DesiredSize: 2,
          MinSize: 1,
          MaxSize: 4,
        },
      });

      // Should not have Fargate profiles
      template.resourceCountIs('AWS::EKS::FargateProfile', 0);

      // Verify output
      expect(eksBuilder.output.cluster).toBeDefined();
      expect(eksBuilder.output.nodeGroups).toHaveLength(1);
      expect(eksBuilder.output.fargateProfiles).toHaveLength(0);
      expect(eksBuilder.output.nodeSecurityGroup).toBeDefined();
    });

    it('should create node groups with spot instances', () => {
      // GIVEN
      const props = {
        computePattern: 'managed-nodes' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'spot',
            instanceTypes: ['t3.medium', 't3.large'],
            capacityType: 'SPOT' as const,
            desired: 1,
            min: 0,
            max: 3,
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN
      new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::EKS::Nodegroup', {
        CapacityType: 'SPOT',
        InstanceTypes: ['t3.medium', 't3.large'],
      });
    });

    it('should create node groups with taints', () => {
      // GIVEN
      const props = {
        computePattern: 'managed-nodes' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'tainted',
            instanceTypes: ['t3.medium'],
            capacityType: 'ON_DEMAND' as const,
            desired: 1,
            min: 1,
            max: 2,
            taints: [
              {
                key: 'dedicated',
                value: 'monitoring',
                effect: 'NO_SCHEDULE' as const,
              },
            ],
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN
      new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::EKS::Nodegroup', {
        Taints: [
          {
            Key: 'dedicated',
            Value: 'monitoring',
            Effect: 'NO_SCHEDULE',
          },
        ],
      });
    });
  });

  describe('mixed pattern', () => {
    it('should create EKS cluster with both Fargate and node groups', () => {
      // GIVEN
      const props = {
        computePattern: 'mixed' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'advanced-cloud',
        nodeGroupConfigs: [
          {
            name: 'general',
            instanceTypes: ['t3.medium'],
            capacityType: 'ON_DEMAND' as const,
            desired: 2,
            min: 1,
            max: 4,
          },
        ],
        fargateProfiles: [
          {
            name: 'system',
            selectors: [{ namespace: 'kube-system' }],
          },
        ],
        managedAddons: [],
      };

      // WHEN
      const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have both node group and Fargate profile
      template.resourceCountIs('AWS::EKS::Nodegroup', 1);
      template.resourceCountIs('AWS::EKS::FargateProfile', 1);

      // Verify output
      expect(eksBuilder.output.nodeGroups).toHaveLength(1);
      expect(eksBuilder.output.fargateProfiles).toHaveLength(1);
    });
  });

  describe('security groups', () => {
    it('should create cluster and node security groups', () => {
      // GIVEN
      const props = {
        computePattern: 'managed-nodes' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'general',
            instanceTypes: ['t3.medium'],
            capacityType: 'ON_DEMAND' as const,
            desired: 1,
            min: 1,
            max: 2,
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN
      const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have security groups
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for EKS cluster control plane',
      });

      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        GroupDescription: 'Security group for EKS worker nodes',
      });

      // Verify output
      expect(eksBuilder.output.clusterSecurityGroup).toBeDefined();
      expect(eksBuilder.output.nodeSecurityGroup).toBeDefined();
    });
  });

  describe('OIDC provider', () => {
    it('should create OIDC provider for service accounts', () => {
      // GIVEN
      const props = {
        computePattern: 'fargate-only' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [],
        fargateProfiles: [
          {
            name: 'system',
            selectors: [{ namespace: 'kube-system' }],
          },
        ],
        managedAddons: [],
      };

      // WHEN
      const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);
      const oidcProvider = eksBuilder.createOidcProvider();

      // THEN
      expect(oidcProvider).toBeDefined();

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::OpenIDConnectProvider', {
        ClientIdList: ['sts.amazonaws.com'],
      });
    });

    it('should create service account with IAM role', () => {
      // GIVEN
      const props = {
        computePattern: 'fargate-only' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [],
        fargateProfiles: [
          {
            name: 'system',
            selectors: [{ namespace: 'kube-system' }],
          },
        ],
        managedAddons: [],
      };

      // WHEN
      const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);
      const role = eksBuilder.createServiceAccountWithRole(
        'default',
        'test-sa',
        []
      );

      // THEN
      expect(role).toBeDefined();

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'admiral-eks-sa-test-sa',
      });
    });
  });

  describe('validation', () => {
    it('should throw error for invalid compute pattern', () => {
      // GIVEN
      const props = {
        computePattern: 'invalid-pattern' as any,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN & THEN
      expect(() => {
        new EKSBuilder(stack, 'TestEKS', props);
      }).toThrow('Invalid compute pattern');
    });

    it('should throw error for fargate-only with node groups', () => {
      // GIVEN
      const props = {
        computePattern: 'fargate-only' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'invalid',
            instanceTypes: ['t3.medium'],
            capacityType: 'ON_DEMAND' as const,
            desired: 1,
            min: 1,
            max: 2,
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN & THEN
      expect(() => {
        new EKSBuilder(stack, 'TestEKS', props);
      }).toThrow('Fargate-only pattern cannot have node group configurations');
    });

    it('should throw error for invalid node group capacity', () => {
      // GIVEN
      const props = {
        computePattern: 'managed-nodes' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'invalid',
            instanceTypes: ['t3.medium'],
            capacityType: 'ON_DEMAND' as const,
            desired: 5, // Invalid: desired > max
            min: 1,
            max: 2,
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN & THEN
      expect(() => {
        new EKSBuilder(stack, 'TestEKS', props);
      }).toThrow('Invalid capacity configuration');
    });

    it('should throw error for empty instance types', () => {
      // GIVEN
      const props = {
        computePattern: 'managed-nodes' as const,
        vpcConfig: vpcBuilder.output,
        version: eks.KubernetesVersion.V1_30,
        environment: 'test',
        homelabType: 'basic-cloud',
        nodeGroupConfigs: [
          {
            name: 'invalid',
            instanceTypes: [], // Invalid: empty
            capacityType: 'ON_DEMAND' as const,
            desired: 1,
            min: 1,
            max: 2,
          },
        ],
        fargateProfiles: [],
        managedAddons: [],
      };

      // WHEN & THEN
      expect(() => {
        new EKSBuilder(stack, 'TestEKS', props);
      }).toThrow('must have at least one instance type');
    });
  });
});