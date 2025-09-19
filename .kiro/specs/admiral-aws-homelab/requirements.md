# Requirements Document

## Introduction

Admiral is a reproducible AWS homelab centered on Amazon EKS, designed as a monolithic repository using the right tool for each job. While AWS CDK (TypeScript) serves as the primary IaC tool for AWS infrastructure, the project integrates additional tools like Helm, Kustomize, Ansible, and Packer where appropriate. Managed by Projen for consistency, Admiral provides an opinionated structure with fast deployment capabilities and selective CNCF integrations for experimentation, learning, and debugging practice. The homelab emphasizes rapid spin-up/tear-down cycles and cost awareness, making it ideal for testing applications, practicing troubleshooting, and exploring cloud-native technologies.

## Requirements

### Requirement 1: Multi-Tool Project Structure and Management

**User Story:** As a developer, I want a monolithic repository that uses the right tool for each job while maintaining consistency through Projen, so that I can efficiently manage infrastructure, configuration, and deployments using appropriate technologies.

#### Acceptance Criteria

1. WHEN the project is initialized THEN the system SHALL use Projen's awscdk-app-ts template as the foundation with CDK v2, Node 20, and pnpm enabled
2. WHEN the project structure is created THEN the system SHALL organize code into logical directories: src/stacks (CDK), src/constructs (CDK), config/environments, k8s/ (YAML manifests), ansible/ (playbooks), packer/ (image builds), and scripts
3. WHEN multiple tools are integrated THEN the system SHALL support Helm charts, Kustomize overlays, Ansible playbooks, and Packer templates alongside CDK
4. WHEN Projen tasks are configured THEN the system SHALL provide tasks for bootstrap, synth, deploy per environment, destroy per environment, lint, format, test, cdk-nag, and tool-specific commands
5. WHEN dependencies are managed THEN the system SHALL include appropriate tooling for each technology stack (CDK, Helm, kubectl, ansible, packer)

### Requirement 2: EKS Core Infrastructure

**User Story:** As a platform engineer, I want a configurable EKS cluster with managed node groups and essential add-ons, so that I can run containerized workloads with proper networking and compute resources.

#### Acceptance Criteria

1. WHEN an EKS cluster is deployed THEN the system SHALL create a cluster with configurable Kubernetes version (1.29, 1.30, etc.)
2. WHEN the EKS cluster is configured THEN the system SHALL enable OIDC provider for service account authentication
3. WHEN node groups are created THEN the system SHALL provision managed node groups with configurable instance types, desired/min/max capacity
4. WHEN Windows support is enabled THEN the system SHALL optionally create Windows node groups based on configuration
5. WHEN managed add-ons are installed THEN the system SHALL deploy VPC CNI, CoreDNS, and kube-proxy pinned to cluster version
6. WHEN the cluster API is configured THEN the system SHALL support both public and private API endpoint access based on parameters

### Requirement 3: Optional CNCF Tool Integration

**User Story:** As a homelab operator, I want selectively deployable CNCF tools that I can quickly enable for experimentation and learning, so that I can practice with different technologies without committing to a full deployment.

#### Acceptance Criteria

1. WHEN GitOps is configured as "flux" THEN the system SHALL deploy Flux controllers via CDK EKS Helm addon or standalone Helm chart
2. WHEN GitOps is configured as "argocd" THEN the system SHALL deploy ArgoCD via CDK EKS Helm addon or standalone Helm chart
3. WHEN GitOps is configured as "none" THEN the system SHALL skip GitOps tool deployment entirely
4. WHEN CNCF tools are optional THEN the system SHALL allow independent enabling/disabling of ingress, service mesh, observability, and certificate management
5. WHEN tool configuration is needed THEN the system SHALL support both CDK-managed Helm releases and external YAML manifests with Kustomize overlays
6. WHEN rapid experimentation is required THEN the system SHALL provide pre-configured tool combinations for common scenarios (basic, observability, service-mesh, full-stack)

### Requirement 4: Observability and Monitoring

**User Story:** As a site reliability engineer, I want observability tooling scaffolded in the cluster, so that I can monitor cluster health and application performance.

#### Acceptance Criteria

1. WHEN observability is enabled THEN the system SHALL deploy Prometheus stack via Helm chart scaffold
2. WHEN observability configuration is provided THEN the system SHALL support custom values files for Prometheus configuration
3. WHEN observability is disabled THEN the system SHALL skip monitoring stack deployment
4. WHEN monitoring is deployed THEN the system SHALL provide extension points for additional observability tools

### Requirement 5: Ingress and Load Balancing

**User Story:** As an application developer, I want ingress capabilities configured in the cluster, so that I can expose applications to external traffic with proper load balancing.

#### Acceptance Criteria

1. WHEN ALB controller is enabled THEN the system SHALL deploy AWS Load Balancer Controller via Helm chart
2. WHEN ingress is configured THEN the system SHALL create necessary IAM roles and policies for ALB controller
3. WHEN ALB controller is disabled THEN the system SHALL skip ingress controller deployment
4. WHEN load balancer configuration changes THEN the system SHALL support custom values overrides for the controller

### Requirement 6: Certificate Management

**User Story:** As a security engineer, I want automated certificate management in the cluster, so that applications can use TLS certificates without manual intervention.

#### Acceptance Criteria

1. WHEN certificate management is enabled THEN the system SHALL deploy cert-manager via Helm chart
2. WHEN cert-manager is configured THEN the system SHALL provide scaffolding for certificate issuers (Let's Encrypt, etc.)
3. WHEN TLS is required THEN the system SHALL support automatic certificate provisioning for ingress resources
4. WHEN certificate configuration changes THEN the system SHALL support custom values files for cert-manager

### Requirement 7: Service Mesh Integration

**User Story:** As a microservices architect, I want optional service mesh capabilities, so that I can implement advanced traffic management, security, and observability between services.

#### Acceptance Criteria

1. WHEN service mesh is configured as "linkerd" THEN the system SHALL deploy Linkerd via Helm chart
2. WHEN service mesh is configured as "istio" THEN the system SHALL deploy Istio via Helm chart
3. WHEN service mesh is configured as "none" THEN the system SHALL skip service mesh deployment
4. WHEN mesh configuration changes THEN the system SHALL support toggling between mesh solutions using context parameters
5. WHEN service mesh is deployed THEN the system SHALL provide configuration hooks for mesh-specific settings

### Requirement 8: Storage Integration

**User Story:** As an application developer, I want persistent storage options available in the cluster, so that applications can store data using AWS storage services.

#### Acceptance Criteria

1. WHEN EBS CSI driver is enabled THEN the system SHALL deploy EBS CSI driver with proper IAM permissions
2. WHEN EFS CSI driver is enabled THEN the system SHALL deploy EFS CSI driver with proper IAM permissions
3. WHEN storage drivers are configured THEN the system SHALL create necessary storage classes for application use
4. WHEN storage is not needed THEN the system SHALL allow disabling CSI drivers to reduce cluster overhead

### Requirement 9: CI/CD Pipeline Integration

**User Story:** As a DevOps engineer, I want automated CI/CD pipelines for infrastructure deployment, so that changes can be tested and deployed consistently across environments.

#### Acceptance Criteria

1. WHEN CDK Pipelines is enabled THEN the system SHALL create a self-mutating pipeline using AWS CodePipeline
2. WHEN pipeline stages are configured THEN the system SHALL support dev (auto-deploy), stage (manual approval), and prod (manual approval) environments
3. WHEN GitHub Actions is preferred THEN the system SHALL provide alternative CI/CD workflows for GitHub
4. WHEN post-deployment validation is required THEN the system SHALL include smoke tests using kubectl commands
5. WHEN pipeline permissions are configured THEN the system SHALL provide documentation for granting necessary EKS access to pipeline roles

### Requirement 10: Multi-Environment Configuration

**User Story:** As a platform engineer, I want environment-specific configuration management, so that I can deploy the same infrastructure pattern across dev, staging, and production with appropriate settings.

#### Acceptance Criteria

1. WHEN environments are configured THEN the system SHALL support separate JSON configuration files for dev, stage, and prod
2. WHEN environment parameters are set THEN the system SHALL include account ID, region, EKS version, node group specifications, and feature toggles
3. WHEN secrets are required THEN the system SHALL integrate with AWS SSM Parameter Store for sensitive configuration
4. WHEN configuration changes THEN the system SHALL validate configuration schema before deployment
5. WHEN multiple environments exist THEN the system SHALL support concurrent deployment to different environments

### Requirement 11: Deployment Speed and Performance Optimization

**User Story:** As a homelab operator, I want extremely fast deployment and teardown cycles, so that I can quickly iterate on experiments without waiting for lengthy provisioning processes.

#### Acceptance Criteria

1. WHEN EKS cluster is deployed THEN the system SHALL use Fargate profiles for critical system pods to avoid waiting for node group initialization
2. WHEN node groups are provisioned THEN the system SHALL use launch templates with pre-built AMIs and optimized instance types for faster boot times
3. WHEN addons are deployed THEN the system SHALL use CDK EKS managed addons where possible to leverage AWS optimization
4. WHEN Helm charts are installed THEN the system SHALL use CDK's HelmChart construct with lambda-based deployment for faster execution than external tools
5. WHEN parallel deployment is possible THEN the system SHALL deploy independent stacks concurrently using CDK's --concurrency flag
6. WHEN cluster networking is configured THEN the system SHALL use AWS VPC CNI in prefix delegation mode for faster pod networking
7. WHEN image pulls are required THEN the system SHALL configure image pull optimization and consider ECR caching strategies
8. WHEN teardown is performed THEN the system SHALL implement parallel resource deletion and force-delete stuck resources after timeout

### Requirement 12: Cost Control and Resource Management

**User Story:** As a homelab operator, I want cost control mechanisms and easy cleanup, so that I can manage AWS costs and avoid unexpected charges from orphaned resources.

#### Acceptance Criteria

1. WHEN test resources are created THEN the system SHALL support tainting node groups for easy identification and use spot instances where appropriate
2. WHEN cleanup is required THEN the system SHALL provide make teardown command that deletes stacks and empties cluster-owned resources including LoadBalancers and EBS volumes
3. WHEN cost monitoring is enabled THEN the system SHALL apply TTL tags to resources with configurable expiration and cost allocation tags
4. WHEN zombie resources exist THEN the system SHALL provide CI reminders and automated cleanup scripts to prevent long-running test clusters
5. WHEN resource limits are needed THEN the system SHALL support configurable resource quotas, limits, and right-sizing recommendations
6. WHEN cost optimization is required THEN the system SHALL prefer Fargate for system workloads and provide node group auto-scaling configurations

### Requirement 12: Code Quality and Security

**User Story:** As a security-conscious developer, I want automated security scanning and code quality checks, so that infrastructure code meets security best practices and coding standards.

#### Acceptance Criteria

1. WHEN code is committed THEN the system SHALL run ESLint, Prettier, and Jest tests via Projen tasks
2. WHEN security scanning is performed THEN the system SHALL use cdk-nag with AWS Solutions ruleset
3. WHEN security violations are found THEN the system SHALL fail the build unless violations are explicitly suppressed
4. WHEN code quality checks run THEN the system SHALL include pre-commit style validation
5. WHEN suppression is needed THEN the system SHALL provide a suppression file scaffold for approved violations

### Requirement 13: Documentation and Developer Experience

**User Story:** As a new team member, I want comprehensive documentation and clear getting-started instructions, so that I can quickly understand and contribute to the project.

#### Acceptance Criteria

1. WHEN documentation is accessed THEN the system SHALL provide a polished README with quickstart instructions
2. WHEN project structure is explored THEN the system SHALL include clear documentation of directory layout and file purposes
3. WHEN configuration options are reviewed THEN the system SHALL provide a table of available context toggles and their effects
4. WHEN diagrams are needed THEN the system SHALL include placeholder directories for architecture diagrams
5. WHEN examples are required THEN the system SHALL provide sample configuration files for each environment

### Requirement 14: Extensibility and Multi-Tool Integration

**User Story:** As a platform engineer, I want clear extension points and the ability to use the right tool for each job, so that I can add new CNCF tools using the most appropriate deployment method (CDK, Helm, Kustomize, or raw YAML).

#### Acceptance Criteria

1. WHEN Helm charts are deployed THEN the system SHALL support both CDK HelmChart constructs and standalone Helm CLI operations
2. WHEN Kubernetes manifests are needed THEN the system SHALL provide k8s/ directory structure with Kustomize overlays for environment-specific configurations
3. WHEN CDK limitations are encountered THEN the system SHALL fall back to kubectl apply with YAML manifests stored in version control
4. WHEN custom images are required THEN the system SHALL integrate Packer for building optimized AMIs and container images
5. WHEN configuration management is needed THEN the system SHALL support Ansible playbooks for post-deployment configuration and application setup
6. WHEN new constructs are created THEN the system SHALL follow established patterns while allowing tool-specific implementations
7. WHEN debugging scenarios are practiced THEN the system SHALL provide sample broken applications and troubleshooting scenarios as YAML manifests
