---
inclusion: always
---

# Technology Stack & Development Guidelines

## Core Stack Requirements

**Build System**: Projen manages all project configuration - never edit generated files directly
**Language**: TypeScript 5.9+ with strict null checks and type safety
**Runtime**: Node.js 20+ required for all operations
**Infrastructure**: AWS CDK v2 for all cloud resources
**Target Platform**: AWS EKS for Kubernetes workloads

## Critical Development Rules

### File Modification Restrictions

- **NEVER edit**: `package.json`, `tsconfig.json`, `.eslintrc.json` (Projen-managed)
- **Always edit**: `.projenrc.ts` for project configuration changes
- **Regenerate after changes**: Run `npm run build` after modifying `.projenrc.ts`

### Code Quality Requirements

- All TypeScript must pass strict type checking
- 100% test coverage expected for new code
- ESLint and Prettier must pass before commits
- Security scanning with cdk-nag required for CDK code

### Environment Management

- Use `--context env={environment}` for CDK operations
- Environment configs must exist in `config/environments/{env}.json`
- Default to `dev` environment for local development
- Validate environment configuration before deployment

## Essential Commands

### Development Workflow

```bash
npm run build          # Full build and validation
npm run compile        # TypeScript compilation only
npm run test           # Run test suite
npm run eslint         # Lint code
npm run prettier       # Format code
```

### CDK Operations

```bash
npm run synth          # Generate CloudFormation templates
npm run deploy:dev     # Deploy to development
npm run diff           # Show deployment differences
npm run destroy:dev    # Clean up development resources
```

### Environment Setup

```bash
./scripts/bootstrap.sh dev              # Bootstrap CDK for environment
./scripts/kubeconfig.sh update dev      # Update EKS kubeconfig
./scripts/kubeconfig.sh switch dev      # Switch kubectl context
```

## Architecture Patterns

### Stack Naming Convention

- Format: `admiral-{env}-{component}`
- Example: `admiral-dev-cluster`, `admiral-prod-networking`

### Resource Tagging Strategy

- Always include: `Environment`, `Project: admiral`, `ManagedBy: cdk`
- Cost tracking: Include `CostCenter` tag for production resources

### Configuration Management

- Environment-specific configs in `config/environments/`
- Type-safe configuration using interfaces in `src/utils/types.ts`
- Validate all configuration before resource creation

## Security & Compliance

### CDK Security Practices

- Run `npm run nag` before deployment to catch security issues
- Use least-privilege IAM policies
- Enable encryption for all data at rest and in transit
- Implement proper VPC security groups and NACLs

### Code Security

- No hardcoded secrets or credentials in code
- Use AWS Secrets Manager or Parameter Store for sensitive data
- Validate all external inputs and configuration
