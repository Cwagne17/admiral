# Project Structure

## Root Directory Layout

```
admiral/
├── .projenrc.ts          # Projen configuration (source of truth)
├── src/                  # TypeScript source code
├── test/                 # Test files
├── config/               # Environment configurations
├── scripts/              # Utility scripts
├── cdk.out/              # CDK synthesis output (generated)
└── node_modules/         # Dependencies (generated)
```

## Source Code Organization (`src/`)

```
src/
├── main.ts              # CDK app entry point
└── utils/               # Shared utilities
    ├── index.ts         # Utility exports
    ├── types.ts         # Type definitions
    ├── aws-utils.ts     # AWS-specific utilities
    ├── config-utils.ts  # Configuration helpers
    └── validation-utils.ts # Validation functions
```

## Configuration Structure (`config/`)

```
config/
└── environments/        # Environment-specific configs
    ├── dev.json        # Development environment
    ├── stage.json      # Staging environment
    └── prod.json       # Production environment
```

## Scripts Directory (`scripts/`)

```
scripts/
├── bootstrap.sh         # CDK bootstrap automation
└── kubeconfig.sh       # EKS kubeconfig management
```

## Architecture Patterns

### Stack Organization

- **Single stack per environment** - `admiral-{env}` naming convention
- **Environment-driven configuration** - Use CDK context and config files
- **Modular constructs** - Separate constructs for different components (EKS, networking, etc.)

### File Naming Conventions

- **Kebab-case** for file names (`my-construct.ts`)
- **PascalCase** for class names (`MyConstruct`)
- **camelCase** for variables and functions
- **SCREAMING_SNAKE_CASE** for constants

### Import Organization

```typescript
// 1. Node.js built-ins
import * as path from "path";

// 2. External libraries
import { App, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

// 3. Internal utilities (relative imports)
import { HomelabConfig } from "./utils";
```

### Configuration Management

- **Environment configs** in `config/environments/{env}.json`
- **CDK context** for environment selection (`--context env=dev`)
- **Type-safe configuration** using interfaces in `src/utils/types.ts`
- **Validation** before deployment using utility functions

### Testing Structure

```
test/
├── main.test.ts         # Main stack tests
├── constructs/          # Individual construct tests
└── utils/               # Utility function tests
```

## Key Conventions

### Environment Handling

- Use `--context env={environment}` for environment selection
- Environment configs must exist in `config/environments/`
- Default to development environment for local testing

### Resource Naming

- **Consistent prefixing**: `admiral-{env}-{resource-type}`
- **Tagging strategy**: Include environment, project, and cost center tags
- **Cluster naming**: `admiral-{env}-cluster`

### Code Organization

- **Single responsibility** - One construct per file when possible
- **Utility functions** - Shared logic in `src/utils/`
- **Type definitions** - Centralized in `src/utils/types.ts`
- **Configuration validation** - Before resource creation

### Generated Files (Do Not Edit)

- `package.json` - Managed by Projen
- `tsconfig.json` - Managed by Projen
- `.eslintrc.json` - Managed by Projen
- `cdk.out/` - CDK synthesis output
