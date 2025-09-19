import { awscdk, javascript } from 'projen';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'admiral',
  description: 'Admiral - Reproducible AWS homelab centered on EKS with multi-tool integration',
  author: 'Admiral Team',
  authorEmail: 'admiral@example.com',
  repository: 'https://github.com/example/admiral.git',

  // Node and package manager configuration
  minNodeVersion: '20.0.0',
  packageManager: javascript.NodePackageManager.NPM,

  // TypeScript configuration
  tsconfig: {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022'],
      moduleResolution: typescript.TypeScriptModuleResolution.NODE,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
  },

  // CDK-specific configuration
  context: {
    '@aws-cdk/aws-lambda:recognizeLayerVersion': true,
    '@aws-cdk/core:checkSecretUsage': true,
    '@aws-cdk/core:target-partitions': ['aws', 'aws-cn'],
    '@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver': true,
    '@aws-cdk/aws-ec2:uniqueImdsv2TemplateName': true,
    '@aws-cdk/aws-ecs:arnFormatIncludesClusterName': true,
    '@aws-cdk/aws-iam:minimizePolicies': true,
    '@aws-cdk/core:validateSnapshotRemovalPolicy': true,
    '@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName': true,
    '@aws-cdk/aws-s3:createDefaultLoggingPolicy': true,
    '@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption': true,
    '@aws-cdk/aws-apigateway:disableCloudWatchRole': true,
    '@aws-cdk/core:enablePartitionLiterals': true,
    '@aws-cdk/aws-events:eventsTargetQueueSameAccount': true,
    '@aws-cdk/aws-iam:standardizedServicePrincipals': true,
    '@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker': true,
    '@aws-cdk/aws-iam:importedRoleStackSafeDefaultPolicyName': true,
    '@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy': true,
    '@aws-cdk/aws-route53-patters:useCertificate': true,
    '@aws-cdk/customresources:installLatestAwsSdkDefault': false,
    '@aws-cdk/aws-rds:databaseProxyUniqueResourceName': true,
    '@aws-cdk/aws-codedeploy:removeAlarmsFromDeploymentGroup': true,
    '@aws-cdk/aws-apigateway:authorizerChangeDeploymentLogicalId': true,
    '@aws-cdk/aws-ec2:launchTemplateDefaultUserData': true,
    '@aws-cdk/aws-secretsmanager:useAttachedSecretResourcePolicyForSecretTargetAttachments': true,
    '@aws-cdk/aws-redshift:columnId': true,
    '@aws-cdk/aws-stepfunctions-tasks:enableLogging': true,
    '@aws-cdk/aws-ec2:restrictDefaultSecurityGroup': true,
    '@aws-cdk/aws-apigateway:requestValidatorUniqueId': true,
    '@aws-cdk/aws-kms:aliasNameRef': true,
    '@aws-cdk/aws-autoscaling:generateLaunchTemplateInsteadOfLaunchConfig': true,
    '@aws-cdk/core:includePrefixInUniqueNameGeneration': true,
    '@aws-cdk/aws-efs:denyAnonymousAccess': true,
    '@aws-cdk/aws-opensearchservice:enableLogging': true,
    '@aws-cdk/aws-s3:autoDeleteObjectsPolicy': true,
    '@aws-cdk/aws-ec2:vpnConnectionLogging': true,
    '@aws-cdk/aws-lambda:codeguruProfiler': true,
    '@aws-cdk/aws-opensearchservice:enableVersionUpgrade': true,
  },

  // Dependencies
  deps: [
    'aws-cdk-lib',
    'constructs',
  ],

  devDeps: [
    'cdk-nag',
    '@types/jest',
    'ts-node',
    '@aws-cdk/assert',
  ],

  // Projen tasks configuration
  buildWorkflow: false, // We'll use GitHub Actions instead
  release: false, // Not needed for homelab project

  // ESLint and Prettier configuration
  eslint: true,
  prettier: true,

  // Jest configuration
  jest: true,
  jestOptions: {
    jestConfig: {
      testEnvironment: 'node',
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**/*',
      ],
      coverageReporters: ['text', 'lcov', 'html'],
      coverageThreshold: {
        './src/**/*.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },

  // Git configuration
  gitignore: [
    '# CDK asset staging directory',
    '.cdk.staging',
    'cdk.out',

    '# Local environment files',
    '.env',
    '.env.local',
    '.env.*.local',

    '# Vagrant files',
    '.vagrant/',
    '*.log',

    '# Ansible files',
    '*.retry',

    '# Packer files',
    'packer_cache/',
    '*.box',

    '# OS generated files',
    '.DS_Store',
    '.DS_Store?',
    '._*',
    '.Spotlight-V100',
    '.Trashes',
    'ehthumbs.db',
    'Thumbs.db',

    '# IDE files',
    '.idea/',
    '*.swp',
    '*.swo',
    '*~',

    '# Temporary files',
    'tmp/',
    'temp/',
  ],
});

// Add custom Projen tasks for homelab operations
project.addTask('bootstrap', {
  description: 'Bootstrap CDK for all environments',
  exec: 'scripts/bootstrap.sh',
});

project.addTask('bootstrap:dev', {
  description: 'Bootstrap CDK for dev environment',
  exec: 'npm run cdk bootstrap -- --context env=dev',
});

project.addTask('bootstrap:stage', {
  description: 'Bootstrap CDK for stage environment',
  exec: 'npm run cdk bootstrap -- --context env=stage',
});

project.addTask('bootstrap:prod', {
  description: 'Bootstrap CDK for prod environment',
  exec: 'npm run cdk bootstrap -- --context env=prod',
});

project.addTask('deploy:dev', {
  description: 'Deploy to dev environment',
  exec: 'npm run cdk deploy -- --all --concurrency 4 --context env=dev',
});

project.addTask('deploy:stage', {
  description: 'Deploy to stage environment',
  exec: 'npm run cdk deploy -- --all --concurrency 4 --context env=stage',
});

project.addTask('deploy:prod', {
  description: 'Deploy to prod environment',
  exec: 'npm run cdk deploy -- --all --concurrency 4 --context env=prod',
});

project.addTask('destroy:dev', {
  description: 'Destroy dev environment',
  exec: 'npm run cdk destroy -- --all --context env=dev',
});

project.addTask('destroy:stage', {
  description: 'Destroy stage environment',
  exec: 'npm run cdk destroy -- --all --context env=stage',
});

project.addTask('destroy:prod', {
  description: 'Destroy prod environment',
  exec: 'npm run cdk destroy -- --all --context env=prod',
});

project.addTask('kube:dev', {
  description: 'Update kubeconfig for dev cluster',
  exec: 'scripts/kubeconfig.sh dev',
});

project.addTask('kube:stage', {
  description: 'Update kubeconfig for stage cluster',
  exec: 'scripts/kubeconfig.sh stage',
});

project.addTask('kube:prod', {
  description: 'Update kubeconfig for prod cluster',
  exec: 'scripts/kubeconfig.sh prod',
});

project.addTask('nag', {
  description: 'Run cdk-nag security checks',
  exec: 'npm run cdk synth -- --context nag=true',
});

project.addTask('local:up', {
  description: 'Start local homelab with Vagrant',
  exec: 'cd local-homelab && vagrant up',
});

project.addTask('local:down', {
  description: 'Stop local homelab',
  exec: 'cd local-homelab && vagrant destroy -f',
});

project.addTask('local:ssh', {
  description: 'SSH into local homelab',
  exec: 'cd local-homelab && vagrant ssh',
});

// GitHub Actions workflow will be added in a later task

project.synth();