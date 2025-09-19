import { awscdk } from 'projen';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'admiral',
  description: 'Admiral - Reproducible AWS homelab centered on EKS with multi-tool integration',

  // Use npm as package manager
  packageManager: 'npm' as any,

  // Node configuration
  minNodeVersion: '20.0.0',

  // Dependencies
  deps: [
    'aws-cdk-lib',
    'constructs',
  ],

  devDeps: [
    'cdk-nag',
    '@types/jest',
    'ts-node',
  ],

  // Disable features we don't need for homelab
  buildWorkflow: false,
  release: false,

  // Basic configuration
  eslint: true,
  prettier: true,
  jest: true,
});

// Add custom tasks for homelab operations
project.addTask('bootstrap:dev', {
  description: 'Bootstrap CDK for dev environment',
  exec: 'npx cdk bootstrap --context env=dev',
});

project.addTask('deploy:dev', {
  description: 'Deploy to dev environment',
  exec: 'npx cdk deploy --all --concurrency 4 --context env=dev',
});

project.addTask('destroy:dev', {
  description: 'Destroy dev environment',
  exec: 'npx cdk destroy --all --context env=dev',
});

project.addTask('nag', {
  description: 'Run cdk-nag security checks',
  exec: 'npx cdk synth --context nag=true',
});

project.synth();