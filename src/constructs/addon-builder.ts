import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { generateResourceName } from '../utils';

export interface AddonBuilderProps {
    /**
     * EKS cluster to install addons on
     */
    cluster: eks.Cluster;

    /**
     * Environment name
     */
    environment: string;

    /**
     * Homelab type
     */
    homelabType: string;

    /**
     * Addon configurations
     */
    addons: AddonConfig[];

    /**
     * Addon dependencies
     */
    dependencies: AddonDependency[];
}

export interface AddonConfig {
    /**
     * Addon name
     */
    name: string;

    /**
     * Whether the addon is enabled
     */
    enabled: boolean;

    /**
     * Deployment method
     */
    deploymentMethod: 'cdk-helm' | 'helm-cli' | 'kustomize' | 'kubectl';

    /**
     * Helm chart configuration (for cdk-helm method)
     */
    helmConfig?: HelmChartConfig;

    /**
     * Values override
     */
    values?: Record<string, any>;

    /**
     * Values file path
     */
    valuesFile?: string;

    /**
     * Kubernetes namespace
     */
    namespace?: string;

    /**
     * Create namespace if it doesn't exist
     */
    createNamespace?: boolean;

    /**
     * Dependencies on other addons
     */
    dependsOn?: string[];

    /**
     * IAM service account configuration
     */
    serviceAccount?: ServiceAccountConfig;
}

export interface HelmChartConfig {
    /**
     * Chart name
     */
    chart: string;

    /**
     * Chart repository URL
     */
    repository?: string;

    /**
     * Chart version
     */
    version?: string;

    /**
     * Release name
     */
    release?: string;
}

export interface ServiceAccountConfig {
    /**
     * Service account name
     */
    name: string;

    /**
     * Namespace for the service account
     */
    namespace: string;

    /**
     * IAM policy statements
     */
    policyStatements: iam.PolicyStatement[];
}

export interface AddonDependency {
    /**
     * Addon name that has the dependency
     */
    addon: string;

    /**
     * Addon names it depends on
     */
    dependsOn: string[];
}

export interface AddonBuilderOutput {
    /**
     * Deployed Helm charts
     */
    helmCharts: eks.HelmChart[];

    /**
     * Created service accounts with IAM roles
     */
    serviceAccounts: { [addonName: string]: iam.Role };

    /**
     * Created namespaces
     */
    namespaces: eks.KubernetesManifest[];

    /**
     * Deployment order based on dependencies
     */
    deploymentOrder: string[];
}

/**
 * AddonBuilder construct for selective addon deployment with dependency management
 */
export class AddonBuilder extends Construct {
    public readonly output: AddonBuilderOutput;

    constructor(scope: Construct, id: string, props: AddonBuilderProps) {
        super(scope, id);

        // Validate props
        this.validateProps(props);

        // Resolve deployment order based on dependencies
        const deploymentOrder = this.resolveDeploymentOrder(props.addons, props.dependencies);

        // Deploy addons in dependency order
        const helmCharts: eks.HelmChart[] = [];
        const serviceAccounts: { [addonName: string]: iam.Role } = {};
        const namespaces: eks.KubernetesManifest[] = [];

        deploymentOrder.forEach((addonName) => {
            const addonConfig = props.addons.find(addon => addon.name === addonName);
            if (!addonConfig || !addonConfig.enabled) {
                return;
            }

            // Create namespace if needed
            if (addonConfig.createNamespace && addonConfig.namespace) {
                const namespace = this.createNamespace(props.cluster, addonConfig);
                namespaces.push(namespace);
            }

            // Create service account with IAM role if needed
            if (addonConfig.serviceAccount) {
                const serviceAccountRole = this.createServiceAccountRole(
                    props.cluster,
                    addonConfig,
                    props.environment
                );
                serviceAccounts[addonName] = serviceAccountRole;
            }

            // Deploy addon based on method
            if (addonConfig.deploymentMethod === 'cdk-helm' && addonConfig.helmConfig) {
                const helmChart = this.deployHelmChart(props.cluster, addonConfig, props.environment);
                helmCharts.push(helmChart);
            }
            // Other deployment methods would be handled here
            // For now, we focus on CDK Helm deployment
        });

        this.output = {
            helmCharts,
            serviceAccounts,
            namespaces,
            deploymentOrder,
        };
    }

    private validateProps(props: AddonBuilderProps): void {
        // Check for duplicate addon names
        const addonNames = props.addons.map(addon => addon.name);
        const duplicates = addonNames.filter((name, index) => addonNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            throw new Error(`Duplicate addon names found: ${duplicates.join(', ')}`);
        }

        // Validate addon configurations
        props.addons.forEach((addon, index) => {
            if (!addon.name) {
                throw new Error(`Addon at index ${index} must have a name`);
            }

            if (addon.deploymentMethod === 'cdk-helm' && !addon.helmConfig) {
                throw new Error(`Addon '${addon.name}' using cdk-helm method must have helmConfig`);
            }

            if (addon.helmConfig && !addon.helmConfig.chart) {
                throw new Error(`Addon '${addon.name}' helmConfig must specify a chart name`);
            }

            if (addon.serviceAccount) {
                if (!addon.serviceAccount.name || !addon.serviceAccount.namespace) {
                    throw new Error(`Addon '${addon.name}' serviceAccount must have name and namespace`);
                }
            }
        });

        // Validate dependencies exist
        props.dependencies.forEach((dep) => {
            const addonExists = props.addons.some(addon => addon.name === dep.addon);
            if (!addonExists) {
                throw new Error(`Dependency references non-existent addon: ${dep.addon}`);
            }

            dep.dependsOn.forEach((depName) => {
                const depExists = props.addons.some(addon => addon.name === depName);
                if (!depExists) {
                    throw new Error(`Dependency '${dep.addon}' references non-existent addon: ${depName}`);
                }
            });
        });
    }

    private resolveDeploymentOrder(addons: AddonConfig[], dependencies: AddonDependency[]): string[] {
        const addonNames = addons.map(addon => addon.name);
        const dependencyMap = new Map<string, string[]>();

        // Build dependency map
        dependencies.forEach((dep) => {
            dependencyMap.set(dep.addon, dep.dependsOn);
        });

        // Also include inline dependencies from addon configs
        addons.forEach((addon) => {
            if (addon.dependsOn && addon.dependsOn.length > 0) {
                const existing = dependencyMap.get(addon.name) || [];
                dependencyMap.set(addon.name, [...existing, ...addon.dependsOn]);
            }
        });

        // Topological sort
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const result: string[] = [];

        const visit = (addonName: string): void => {
            if (visiting.has(addonName)) {
                throw new Error(`Circular dependency detected involving addon: ${addonName}`);
            }

            if (visited.has(addonName)) {
                return;
            }

            visiting.add(addonName);

            const deps = dependencyMap.get(addonName) || [];
            deps.forEach((dep) => {
                if (addonNames.includes(dep)) {
                    visit(dep);
                }
            });

            visiting.delete(addonName);
            visited.add(addonName);
            result.push(addonName);
        };

        addonNames.forEach((addonName) => {
            if (!visited.has(addonName)) {
                visit(addonName);
            }
        });

        return result;
    }

    private createNamespace(cluster: eks.Cluster, addonConfig: AddonConfig): eks.KubernetesManifest {
        const namespaceName = addonConfig.namespace!;

        return cluster.addManifest(`${addonConfig.name}-namespace`, {
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: {
                name: namespaceName,
                labels: {
                    'app.kubernetes.io/managed-by': 'admiral',
                    'admiral.homelab/addon': addonConfig.name,
                },
            },
        });
    }

    private createServiceAccountRole(
        cluster: eks.Cluster,
        addonConfig: AddonConfig,
        environment: string
    ): iam.Role {
        const serviceAccountConfig = addonConfig.serviceAccount!;
        const roleName = generateResourceName('admiral', environment, `sa-${serviceAccountConfig.name}`);

        // Get OIDC provider URL from cluster
        const oidcProviderUrl = cluster.clusterOpenIdConnectIssuerUrl;
        const oidcProviderArn = cluster.openIdConnectProvider.openIdConnectProviderArn;

        const role = new iam.Role(this, `ServiceAccountRole-${addonConfig.name}`, {
            roleName,
            assumedBy: new iam.FederatedPrincipal(
                oidcProviderArn,
                {
                    StringEquals: {
                        [`${oidcProviderUrl.replace('https://', '')}:sub`]:
                            `system:serviceaccount:${serviceAccountConfig.namespace}:${serviceAccountConfig.name}`,
                        [`${oidcProviderUrl.replace('https://', '')}:aud`]: 'sts.amazonaws.com',
                    },
                },
                'sts:AssumeRoleWithWebIdentity'
            ),
        });

        // Add policy statements to the role
        serviceAccountConfig.policyStatements.forEach((statement) => {
            role.addToPolicy(statement);
        });

        return role;
    }

    private deployHelmChart(
        cluster: eks.Cluster,
        addonConfig: AddonConfig,
        environment: string
    ): eks.HelmChart {
        const helmConfig = addonConfig.helmConfig!;
        const releaseName = helmConfig.release || `${addonConfig.name}-${environment}`;

        // Merge values from config and values file
        let values = addonConfig.values || {};

        // If service account is configured, add it to values
        if (addonConfig.serviceAccount) {
            values = {
                ...values,
                serviceAccount: {
                    create: false, // We'll create it separately
                    name: addonConfig.serviceAccount.name,
                    annotations: {
                        'eks.amazonaws.com/role-arn': this.output.serviceAccounts[addonConfig.name]?.roleArn,
                    },
                },
            };
        }

        const helmChart = cluster.addHelmChart(`${addonConfig.name}-chart`, {
            chart: helmConfig.chart,
            repository: helmConfig.repository,
            version: helmConfig.version,
            release: releaseName,
            namespace: addonConfig.namespace,
            createNamespace: false, // We handle namespace creation separately
            values,
        });

        // Add dependency on namespace if it was created
        if (addonConfig.createNamespace && addonConfig.namespace) {
            const namespace = this.output.namespaces.find(ns =>
                ns.node.id.includes(`${addonConfig.name}-namespace`)
            );
            if (namespace) {
                helmChart.node.addDependency(namespace);
            }
        }

        return helmChart;
    }

    /**
     * Get addon by name
     */
    public getAddon(name: string): AddonConfig | undefined {
        // This would need access to the original props, so we'd need to store them
        // For now, return undefined as a placeholder
        return undefined;
    }

    /**
     * Check if addon is deployed
     */
    public isAddonDeployed(name: string): boolean {
        return this.output.deploymentOrder.includes(name);
    }

    /**
     * Get service account role for addon
     */
    public getServiceAccountRole(addonName: string): iam.Role | undefined {
        return this.output.serviceAccounts[addonName];
    }
}