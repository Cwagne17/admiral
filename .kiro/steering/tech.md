---
inclusion: always
---

# Technology Stack & Development Guidelines

## Core Stack Requirements

- **Build System**: Projen manages all project configuration
- **Language**: TypeScript 5.9+ with strict null checks and type safety
- **Runtime**: Node.js 20+ required for all operations
- **Infrastructure**: AWS CDK v2 for all cloud resources
- **Target Platform**: AWS EKS for Kubernetes workloads

## Critical Development Rules

### File Modification Restrictions

**NEVER EDIT these Projen-managed files:**

- `package.json`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc.json`
- Any file in `.projen/` directory
- Generated CDK output in `cdk.out/`

**ALWAYS EDIT `.projenrc.ts`** for project configuration changes, then run `npm run build`

### Code Quality Requirements

- All TypeScript must pass strict type checking (no `any` types)
- 100% test coverage expected for new code
- ESLint and Prettier must pass before commits
- Security scanning with cdk-nag required for CDK code
- Use enum values instead of string literals for typed properties

### Environment Management

- Use `--context env={environment}` for all CDK operations
- Environment configs must exist in `config/environments/{env}.json`
- Default to `dev` environment for local development
- Always validate environment configuration before deployment

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
- Examples: `admiral-dev-cluster`, `admiral-prod-networking`

### Resource Tagging Strategy

**Required tags for all resources:**

- `Environment`: dev/stage/prod
- `Project`: admiral
- `ManagedBy`: cdk
- `CostCenter`: (production only)

### Configuration Management

- Environment-specific configs in `config/environments/{env}.json`
- Type-safe configuration using interfaces in `src/utils/types.ts`
- Always validate configuration before resource creation
- Use CDK context: `--context env={environment}`

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
- Follow principle of least privilege for all IAM roles
