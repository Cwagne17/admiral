---
inclusion: always
---

# Error Prevention & Resolution Guidelines

## Critical Error Prevention Rules

### Admiral Homelab Specific Requirements

**Use string literals for homelab configurations (Admiral pattern):**

- ✅ `pattern: "public-only" | "private-nat" | "vpc-endpoints"`
- ✅ `type: "local" | "basic-cloud" | "advanced-cloud"`
- ✅ `environment: "dev" | "stage" | "prod"`
- ✅ String literals in interfaces for configuration flexibility

### Pre-Change Validation (REQUIRED WORKFLOW)

**Run these commands before making any changes:**

1. `npm run compile` - Catch TypeScript errors
2. `npm test -- --testPathPatterns=<component>` - Test specific component
3. `npm run eslint` - Check code style
4. **Fix ALL errors before proceeding** - no technical debt accumulation
5. **Commit frequently** - user wants rollback capability

### Common Admiral Project Errors to Avoid

- **CDK construct API mismatches** (most frequent issue)
- Missing AWS service imports (`aws-cdk-lib/aws-*`)
- Incorrect VPC endpoint service names (check AWS CDK docs)
- Missing required properties in homelab configurations
- Using deprecated CDK patterns or APIs

## Error Resolution Process

### When CDK Tests Fail (STEP-BY-STEP)

1. **Read CDK error message carefully** - often points to exact API issue
2. **Check AWS CDK documentation** for correct service names and properties
3. **Verify imports** - ensure all AWS services are imported correctly
4. **Test incrementally** - run tests after each fix
5. **Check CDK version compatibility** - we're using CDK v2

### CDK-Specific Resolution Checklist

- ✅ Correct AWS service imports (`aws-cdk-lib/aws-ec2`, etc.)?
- ✅ VPC endpoint service names match CDK constants?
- ✅ Security group rules properly configured?
- ✅ Resource naming follows Admiral conventions?
- ✅ All required CDK construct properties provided?

### Jest Configuration Warnings

- ts-jest warnings about hybrid modules are **non-blocking**
- **Focus on actual test failures and TypeScript compilation errors first**
- CDK Template assertions are the primary validation method

## Quality Gates (MUST PASS)

- ✅ **Zero TypeScript compilation errors** before committing
- ✅ **All tests passing** with good coverage (>95% for constructs)
- ✅ **ESLint clean** for consistent code style
- ✅ **CDK synth successful** - infrastructure can be generated
- ✅ **Frequent commits** - enable easy rollback as requested

## Admiral Homelab Debugging Strategy

1. **Start with CDK synthesis errors** (infrastructure validation)
2. **Fix AWS service API mismatches** by checking CDK documentation
3. **Ensure proper AWS resource configuration** for EKS requirements
4. **Run construct-specific tests** to verify functionality
5. **Commit working increments** - user values rollback capability

### Common Admiral Fix Patterns

```typescript
// ✅ Correct: String literal types for configuration
interface VPCBuilderProps {
  pattern: "public-only" | "private-nat" | "vpc-endpoints";
}

// ✅ Correct: AWS CDK service imports
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";

// ✅ Correct: VPC endpoint service constants
service: ec2.InterfaceVpcEndpointAwsService.ECR;

// ❌ Wrong: Incorrect service name
service: ec2.InterfaceVpcEndpointAwsService.ECR_API; // Does not exist
```

### Task Management Requirements

- ✅ **Mark tasks complete** using taskStatus tool as you finish them
- ✅ **Work on one task at a time** - don't jump ahead
- ✅ **Commit after each major milestone** - enable rollback
- ✅ **Test thoroughly** before marking tasks complete
