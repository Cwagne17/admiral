import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import { EKSBuilder } from '../../src/constructs/eks-builder';
import { VPCBuilder } from '../../src/constructs/vpc-builder';

describe('EKSBuilder', () => {
    let app: App;
    let stack: Stack;
    let vpc: ec2.IVpc;

    beforeEach(() => {
        app = new App();
        stack = new Stack(app, 'TestStack');

        // Create a VPC for testing
        const vpcBuilder = new VPCBuilder(stack, 'TestVPC', {
            pattern: 'public-only',
            azCount: 2,
            vpcCidr: '10.0.0.0/16',
            environment: 'test',
            homelabType: 'basic-cloud',
            enableFlowLogs: false,
        });
        vpc = vpcBuilder.output.vpc;
    });

    describe('fargate-only pattern', () => {
        it('should create EKS cluster with Fargate profiles only', () => {
            // GIVEN
            const props = {
                computePattern: 'fargate-only' as const,
                vpc,
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
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have EKS cluster
            template.hasResourceProperties('AWS::EKS::Cluster', {
                Name: 'admiral-test-cluster',
            });

            // Should have Fargate profile
            template.hasResourceProperties('AWS::EKS::FargateProfile', {
                Selectors: [
                    { Namespace: 'kube-system' },
                    { Namespace: 'default' },
                ],
            });

            // Should not have node groups
            template.resourceCountIs('AWS::EKS::Nodegroup', 0);

            // Verify output structure
            expect(eksBuilder.output.cluster).toBeDefined();
            expect(eksBuilder.output.fargateProfiles).toHaveLength(1);
            expect(eksBuilder.output.nodeGroups).toHaveLength(0);
            expect(eksBuilder.output.nodeSecurityGroup).toBeUndefined();
        });

        it('should create managed addons without EBS CSI driver', () => {
            // GIVEN
            const props = {
                computePattern: 'fargate-only' as const,
                vpc,
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
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have 3 managed addons (vpc-cni, coredns, kube-proxy) but not EBS CSI
            template.resourceCountIs('AWS::EKS::Addon', 3);

            // Verify addons
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'vpc-cni' });
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'coredns' });
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'kube-proxy' });

            expect(eksBuilder.output.managedAddons).toHaveLength(3);
        });
    });

    describe('managed-nodes pattern', () => {
        it('should create EKS cluster with managed node groups', () => {
            // GIVEN
            const props = {
                computePattern: 'managed-nodes' as const,
                vpc,
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

            // Should have node security group
            template.hasResourceProperties('AWS::EC2::SecurityGroup', {
                GroupDescription: 'Security group for EKS worker nodes',
            });

            // Verify output structure
            expect(eksBuilder.output.cluster).toBeDefined();
            expect(eksBuilder.output.nodeGroups).toHaveLength(1);
            expect(eksBuilder.output.fargateProfiles).toHaveLength(0);
            expect(eksBuilder.output.nodeSecurityGroup).toBeDefined();
        });

        it('should create managed addons including EBS CSI driver', () => {
            // GIVEN
            const props = {
                computePattern: 'managed-nodes' as const,
                vpc,
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
                    },
                ],
                fargateProfiles: [],
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have 4 managed addons including EBS CSI driver
            template.resourceCountIs('AWS::EKS::Addon', 4);

            // Verify addons
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'vpc-cni' });
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'coredns' });
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'kube-proxy' });
            template.hasResourceProperties('AWS::EKS::Addon', { AddonName: 'aws-ebs-csi-driver' });

            expect(eksBuilder.output.managedAddons).toHaveLength(4);
        });

        it('should create launch template with proper configuration', () => {
            // GIVEN
            const props = {
                computePattern: 'managed-nodes' as const,
                vpc,
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
                    },
                ],
                fargateProfiles: [],
            };

            // WHEN
            new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have launch template
            template.hasResourceProperties('AWS::EC2::LaunchTemplate', {
                LaunchTemplateName: 'admiral-test-lt-general',
                LaunchTemplateData: {
                    BlockDeviceMappings: [
                        {
                            DeviceName: '/dev/xvda',
                            Ebs: {
                                VolumeSize: 20,
                                VolumeType: 'gp3',
                                Encrypted: true,
                            },
                        },
                    ],
                },
            });
        });
    });

    describe('mixed pattern', () => {
        it('should create EKS cluster with both Fargate and node groups', () => {
            // GIVEN
            const props = {
                computePattern: 'mixed' as const,
                vpc,
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
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have both node group and Fargate profile
            template.resourceCountIs('AWS::EKS::Nodegroup', 1);
            template.resourceCountIs('AWS::EKS::FargateProfile', 1);

            // Verify output structure
            expect(eksBuilder.output.nodeGroups).toHaveLength(1);
            expect(eksBuilder.output.fargateProfiles).toHaveLength(1);
            expect(eksBuilder.output.nodeSecurityGroup).toBeDefined();
        });
    });

    describe('windows pattern', () => {
        it('should create EKS cluster with Windows node groups', () => {
            // GIVEN
            const props = {
                computePattern: 'windows' as const,
                vpc,
                version: eks.KubernetesVersion.V1_30,
                environment: 'test',
                homelabType: 'advanced-cloud',
                nodeGroupConfigs: [
                    {
                        name: 'windows',
                        instanceTypes: ['m5.large'],
                        capacityType: 'ON_DEMAND' as const,
                        desired: 1,
                        min: 1,
                        max: 2,
                    },
                ],
                fargateProfiles: [],
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have node group
            template.hasResourceProperties('AWS::EKS::Nodegroup', {
                NodegroupName: 'admiral-test-ng-windows',
            });

            // Should not have Fargate profiles (Windows doesn't support Fargate)
            template.resourceCountIs('AWS::EKS::FargateProfile', 0);

            expect(eksBuilder.output.nodeGroups).toHaveLength(1);
            expect(eksBuilder.output.fargateProfiles).toHaveLength(0);
        });
    });

    describe('node group configuration', () => {
        it('should support node taints', () => {
            // GIVEN
            const props = {
                computePattern: 'managed-nodes' as const,
                vpc,
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
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have node group with taints
            template.hasResourceProperties('AWS::EKS::Nodegroup', {
                Taints: [
                    {
                        Key: 'dedicated',
                        Value: 'monitoring',
                        Effect: 'NO_SCHEDULE',
                    },
                ],
            });

            expect(eksBuilder.output.nodeGroups).toHaveLength(1);
        });

        it('should support multiple node groups', () => {
            // GIVEN
            const props = {
                computePattern: 'managed-nodes' as const,
                vpc,
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
                    {
                        name: 'monitoring',
                        instanceTypes: ['m5.large'],
                        capacityType: 'ON_DEMAND' as const,
                        desired: 1,
                        min: 1,
                        max: 2,
                    },
                ],
                fargateProfiles: [],
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have two node groups
            template.resourceCountIs('AWS::EKS::Nodegroup', 2);
            template.hasResourceProperties('AWS::EKS::Nodegroup', {
                NodegroupName: 'admiral-test-ng-general',
            });
            template.hasResourceProperties('AWS::EKS::Nodegroup', {
                NodegroupName: 'admiral-test-ng-monitoring',
            });

            expect(eksBuilder.output.nodeGroups).toHaveLength(2);
        });
    });

    describe('cluster configuration', () => {
        it('should support private endpoint access', () => {
            // GIVEN
            const props = {
                computePattern: 'fargate-only' as const,
                vpc,
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
                privateEndpoint: true,
            };

            // WHEN
            new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have private endpoint access
            template.hasResourceProperties('AWS::EKS::Cluster', {
                ResourcesVpcConfig: {
                    EndpointConfigPrivate: true,
                    EndpointConfigPublic: false,
                },
            });
        });

        it('should support cluster logging', () => {
            // GIVEN
            const props = {
                computePattern: 'fargate-only' as const,
                vpc,
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
                enableLogging: true,
            };

            // WHEN
            new EKSBuilder(stack, 'TestEKS', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have cluster logging enabled
            template.hasResourceProperties('AWS::EKS::Cluster', {
                Logging: {
                    ClusterLogging: {
                        EnabledTypes: [
                            { Type: 'api' },
                            { Type: 'audit' },
                            { Type: 'authenticator' },
                            { Type: 'controllerManager' },
                            { Type: 'scheduler' },
                        ],
                    },
                },
            });
        });
    });

    describe('validation', () => {
        it('should throw error for invalid compute pattern', () => {
            // GIVEN
            const props = {
                computePattern: 'invalid-pattern' as any,
                vpc,
                version: eks.KubernetesVersion.V1_30,
                environment: 'test',
                homelabType: 'basic-cloud',
                nodeGroupConfigs: [],
                fargateProfiles: [],
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
                vpc,
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
                    },
                ],
                fargateProfiles: [],
            };

            // WHEN & THEN
            expect(() => {
                new EKSBuilder(stack, 'TestEKS', props);
            }).toThrow('Fargate-only pattern cannot have node group configurations');
        });

        it('should throw error for managed-nodes with Fargate profiles', () => {
            // GIVEN
            const props = {
                computePattern: 'managed-nodes' as const,
                vpc,
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
            };

            // WHEN & THEN
            expect(() => {
                new EKSBuilder(stack, 'TestEKS', props);
            }).toThrow('Managed-nodes pattern cannot have Fargate profile configurations');
        });

        it('should throw error for windows with Fargate profiles', () => {
            // GIVEN
            const props = {
                computePattern: 'windows' as const,
                vpc,
                version: eks.KubernetesVersion.V1_30,
                environment: 'test',
                homelabType: 'advanced-cloud',
                nodeGroupConfigs: [],
                fargateProfiles: [
                    {
                        name: 'system',
                        selectors: [{ namespace: 'kube-system' }],
                    },
                ],
            };

            // WHEN & THEN
            expect(() => {
                new EKSBuilder(stack, 'TestEKS', props);
            }).toThrow('Windows pattern does not support Fargate profiles');
        });
    });

    describe('helper methods', () => {
        it('should create service account role with IRSA', () => {
            // GIVEN
            const props = {
                computePattern: 'fargate-only' as const,
                vpc,
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
            };

            // WHEN
            const eksBuilder = new EKSBuilder(stack, 'TestEKS', props);
            const role = eksBuilder.createServiceAccountRole(
                'test-service-account',
                'default',
                []
            );

            // THEN
            expect(role).toBeDefined();

            const template = Template.fromStack(stack);
            template.hasResourceProperties('AWS::IAM::Role', {
                RoleName: 'admiral-irsa-default-test-service-account',
            });
        });
    });
});