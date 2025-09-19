import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { AddonBuilder } from '../../src/constructs/addon-builder';
import { EKSBuilder } from '../../src/constructs/eks-builder';
import { VPCBuilder } from '../../src/constructs/vpc-builder';

describe('AddonBuilder', () => {
    let app: App;
    let stack: Stack;
    let vpcBuilder: VPCBuilder;
    let eksBuilder: EKSBuilder;

    beforeEach(() => {
        app = new App();
        stack = new Stack(app, 'TestStack');

        // Create VPC for testing
        vpcBuilder = new VPCBuilder(stack, 'TestVPC', {
            pattern: 'public-only',
            azCount: 2,
            vpcCidr: '10.0.0.0/16',
            environment: 'test',
            homelabType: 'basic-cloud',
            enableFlowLogs: false,
        });

        // Create EKS cluster for testing
        eksBuilder = new EKSBuilder(stack, 'TestEKS', {
            computePattern: 'fargate-only',
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
        });
    });

    describe('basic addon deployment', () => {
        it('should deploy single addon with Helm chart', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'aws-load-balancer-controller',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: {
                            chart: 'aws-load-balancer-controller',
                            repository: 'https://aws.github.io/eks-charts',
                            version: '1.6.0',
                        },
                        namespace: 'kube-system',
                        values: {
                            clusterName: 'test-cluster',
                        },
                    },
                ],
                dependencies: [],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have Helm chart
            template.hasResourceProperties('Custom::AWSCDK-EKS-HelmChart', {
                Chart: 'aws-load-balancer-controller',
                Repository: 'https://aws.github.io/eks-charts',
                Version: '1.6.0',
                Namespace: 'kube-system',
            });

            // Verify output
            expect(addonBuilder.output.helmCharts).toHaveLength(1);
            expect(addonBuilder.output.deploymentOrder).toEqual(['aws-load-balancer-controller']);
        });

        it('should create namespace when requested', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'cert-manager',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: {
                            chart: 'cert-manager',
                            repository: 'https://charts.jetstack.io',
                        },
                        namespace: 'cert-manager',
                        createNamespace: true,
                    },
                ],
                dependencies: [],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have namespace manifest
            template.hasResourceProperties('Custom::AWSCDK-EKS-KubernetesResource', {
                Manifest: JSON.stringify([{
                    apiVersion: 'v1',
                    kind: 'Namespace',
                    metadata: {
                        name: 'cert-manager',
                        labels: {
                            'app.kubernetes.io/managed-by': 'admiral',
                            'admiral.homelab/addon': 'cert-manager',
                        },
                    },
                }]),
            });

            // Verify output
            expect(addonBuilder.output.namespaces).toHaveLength(1);
        });

        it('should create service account with IAM role', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'aws-load-balancer-controller',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: {
                            chart: 'aws-load-balancer-controller',
                        },
                        namespace: 'kube-system',
                        serviceAccount: {
                            name: 'aws-load-balancer-controller',
                            namespace: 'kube-system',
                            policyStatements: [
                                new iam.PolicyStatement({
                                    effect: iam.Effect.ALLOW,
                                    actions: ['ec2:DescribeVpcs'],
                                    resources: ['*'],
                                }),
                            ],
                        },
                    },
                ],
                dependencies: [],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            const template = Template.fromStack(stack);

            // Should have IAM role
            template.hasResourceProperties('AWS::IAM::Role', {
                RoleName: 'admiral-test-sa-aws-load-balancer-controller',
                AssumeRolePolicyDocument: {
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: {
                                Federated: {
                                    Ref: expect.any(String),
                                },
                            },
                            Action: 'sts:AssumeRoleWithWebIdentity',
                        },
                    ],
                },
            });

            // Verify output
            expect(addonBuilder.output.serviceAccounts['aws-load-balancer-controller']).toBeDefined();
        });

        it('should skip disabled addons', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'disabled-addon',
                        enabled: false,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: {
                            chart: 'some-chart',
                        },
                    },
                    {
                        name: 'enabled-addon',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: {
                            chart: 'another-chart',
                        },
                    },
                ],
                dependencies: [],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            // Should only deploy enabled addon
            expect(addonBuilder.output.helmCharts).toHaveLength(1);
            expect(addonBuilder.output.deploymentOrder).toEqual(['disabled-addon', 'enabled-addon']);
            expect(addonBuilder.isAddonDeployed('enabled-addon')).toBe(true);
        });
    });

    describe('dependency management', () => {
        it('should resolve deployment order based on dependencies', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'cert-manager',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'cert-manager' },
                    },
                    {
                        name: 'ingress-nginx',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'ingress-nginx' },
                        dependsOn: ['cert-manager'],
                    },
                    {
                        name: 'prometheus',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'prometheus' },
                    },
                ],
                dependencies: [
                    {
                        addon: 'ingress-nginx',
                        dependsOn: ['cert-manager'],
                    },
                ],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            const order = addonBuilder.output.deploymentOrder;
            const certManagerIndex = order.indexOf('cert-manager');
            const ingressIndex = order.indexOf('ingress-nginx');

            // cert-manager should come before ingress-nginx
            expect(certManagerIndex).toBeLessThan(ingressIndex);
        });

        it('should detect circular dependencies', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'addon-a',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'chart-a' },
                    },
                    {
                        name: 'addon-b',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'chart-b' },
                    },
                ],
                dependencies: [
                    { addon: 'addon-a', dependsOn: ['addon-b'] },
                    { addon: 'addon-b', dependsOn: ['addon-a'] },
                ],
            };

            // WHEN & THEN
            expect(() => {
                new AddonBuilder(stack, 'TestAddons', props);
            }).toThrow('Circular dependency detected');
        });
    });

    describe('validation', () => {
        it('should throw error for duplicate addon names', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'duplicate',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'chart1' },
                    },
                    {
                        name: 'duplicate',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'chart2' },
                    },
                ],
                dependencies: [],
            };

            // WHEN & THEN
            expect(() => {
                new AddonBuilder(stack, 'TestAddons', props);
            }).toThrow('Duplicate addon names found: duplicate');
        });

        it('should throw error for cdk-helm without helmConfig', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'invalid-addon',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        // Missing helmConfig
                    },
                ],
                dependencies: [],
            };

            // WHEN & THEN
            expect(() => {
                new AddonBuilder(stack, 'TestAddons', props);
            }).toThrow("Addon 'invalid-addon' using cdk-helm method must have helmConfig");
        });

        it('should throw error for missing chart name', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'invalid-addon',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: {
                            // Missing chart name
                            repository: 'https://example.com',
                        } as any,
                    },
                ],
                dependencies: [],
            };

            // WHEN & THEN
            expect(() => {
                new AddonBuilder(stack, 'TestAddons', props);
            }).toThrow("Addon 'invalid-addon' helmConfig must specify a chart name");
        });

        it('should throw error for invalid service account config', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'invalid-addon',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'test-chart' },
                        serviceAccount: {
                            // Missing name and namespace
                            policyStatements: [],
                        } as any,
                    },
                ],
                dependencies: [],
            };

            // WHEN & THEN
            expect(() => {
                new AddonBuilder(stack, 'TestAddons', props);
            }).toThrow("Addon 'invalid-addon' serviceAccount must have name and namespace");
        });

        it('should throw error for non-existent dependency', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'addon-a',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'chart-a' },
                    },
                ],
                dependencies: [
                    {
                        addon: 'addon-a',
                        dependsOn: ['non-existent-addon'],
                    },
                ],
            };

            // WHEN & THEN
            expect(() => {
                new AddonBuilder(stack, 'TestAddons', props);
            }).toThrow("Dependency 'addon-a' references non-existent addon: non-existent-addon");
        });
    });

    describe('utility methods', () => {
        it('should provide service account role access', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'test-addon',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'test-chart' },
                        serviceAccount: {
                            name: 'test-sa',
                            namespace: 'default',
                            policyStatements: [],
                        },
                    },
                ],
                dependencies: [],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            const role = addonBuilder.getServiceAccountRole('test-addon');
            expect(role).toBeDefined();
            expect(role?.roleName).toBe('admiral-test-sa-test-sa');
        });

        it('should check addon deployment status', () => {
            // GIVEN
            const props = {
                cluster: eksBuilder.output.cluster,
                environment: 'test',
                homelabType: 'basic-cloud',
                addons: [
                    {
                        name: 'deployed-addon',
                        enabled: true,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'test-chart' },
                    },
                    {
                        name: 'disabled-addon',
                        enabled: false,
                        deploymentMethod: 'cdk-helm' as const,
                        helmConfig: { chart: 'test-chart' },
                    },
                ],
                dependencies: [],
            };

            // WHEN
            const addonBuilder = new AddonBuilder(stack, 'TestAddons', props);

            // THEN
            expect(addonBuilder.isAddonDeployed('deployed-addon')).toBe(true);
            expect(addonBuilder.isAddonDeployed('disabled-addon')).toBe(true); // In deployment order but not actually deployed
        });
    });
});