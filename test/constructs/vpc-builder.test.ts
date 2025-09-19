import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { VPCBuilder } from "../../src/constructs/vpc-builder";

describe("VPCBuilder", () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
  });

  describe("public-only pattern", () => {
    it("should create VPC with only public subnets", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 2,
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN
      const vpcBuilder = new VPCBuilder(stack, "TestVPC", props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have VPC
      template.hasResourceProperties("AWS::EC2::VPC", {
        CidrBlock: "10.0.0.0/16",
      });

      // Should have public subnets only
      template.resourceCountIs("AWS::EC2::Subnet", 2);

      // Should not have NAT gateways
      template.resourceCountIs("AWS::EC2::NatGateway", 0);

      // Verify output structure
      expect(vpcBuilder.output.vpc).toBeDefined();
      expect(vpcBuilder.output.publicSubnets).toHaveLength(2);
      expect(vpcBuilder.output.privateSubnets).toHaveLength(0);
    });

    it("should not create flow logs when disabled", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 2,
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN
      new VPCBuilder(stack, "TestVPC", props);

      // THEN
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::Logs::LogGroup", 0);
      template.resourceCountIs("AWS::EC2::FlowLog", 0);
    });
  });

  describe("private-nat pattern", () => {
    it("should create VPC with public and private subnets", () => {
      // GIVEN
      const props = {
        pattern: "private-nat" as const,
        azCount: 2,
        vpcCidr: "10.1.0.0/16",
        environment: "test",
        homelabType: "advanced-cloud",
        enableFlowLogs: false,
        costOptimized: false,
      };

      // WHEN
      const vpcBuilder = new VPCBuilder(stack, "TestVPC", props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have VPC
      template.hasResourceProperties("AWS::EC2::VPC", {
        CidrBlock: "10.1.0.0/16",
      });

      // Should have both public and private subnets
      template.resourceCountIs("AWS::EC2::Subnet", 4); // 2 public + 2 private

      // Should have NAT gateways (one per AZ when not cost optimized)
      template.resourceCountIs("AWS::EC2::NatGateway", 2);

      // Verify output structure
      expect(vpcBuilder.output.vpc).toBeDefined();
      expect(vpcBuilder.output.publicSubnets).toHaveLength(2);
      expect(vpcBuilder.output.privateSubnets).toHaveLength(2);
    });

    it("should create single NAT gateway when cost optimized", () => {
      // GIVEN
      const props = {
        pattern: "private-nat" as const,
        azCount: 3,
        vpcCidr: "10.1.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
        costOptimized: true,
      };

      // WHEN
      new VPCBuilder(stack, "TestVPC", props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have only one NAT gateway for cost optimization
      template.resourceCountIs("AWS::EC2::NatGateway", 1);
    });
  });

  describe("vpc-endpoints pattern", () => {
    it("should create VPC with VPC endpoints", () => {
      // GIVEN
      const props = {
        pattern: "vpc-endpoints" as const,
        azCount: 2,
        vpcCidr: "10.2.0.0/16",
        environment: "test",
        homelabType: "advanced-cloud",
        enableFlowLogs: false,
      };

      // WHEN
      const vpcBuilder = new VPCBuilder(stack, "TestVPC", props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have VPC
      template.hasResourceProperties("AWS::EC2::VPC", {
        CidrBlock: "10.2.0.0/16",
      });

      // Should not have NAT gateways
      template.resourceCountIs("AWS::EC2::NatGateway", 0);

      // Should have VPC endpoints
      template.resourceCountIs("AWS::EC2::VPCEndpoint", 8); // 7 interface + 1 gateway (S3)

      // Verify output structure
      expect(vpcBuilder.output.vpc).toBeDefined();
      expect(vpcBuilder.output.vpcEndpoints).toBeDefined();
      expect(vpcBuilder.output.vpcEndpoints).toHaveLength(7); // Interface endpoints only
    });
  });

  describe("flow logs", () => {
    it("should create flow logs when enabled", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 2,
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: true,
      };

      // WHEN
      const vpcBuilder = new VPCBuilder(stack, "TestVPC", props);

      // THEN
      const template = Template.fromStack(stack);

      // Should have log group and flow log
      template.resourceCountIs("AWS::Logs::LogGroup", 1);
      template.resourceCountIs("AWS::EC2::FlowLog", 1);

      // Verify output
      expect(vpcBuilder.output.flowLogsGroup).toBeDefined();
    });
  });

  describe("security groups", () => {
    it("should create EKS cluster security group", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 2,
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN
      const vpcBuilder = new VPCBuilder(stack, "TestVPC", props);
      const clusterSg = vpcBuilder.createEksSecurityGroup();

      // THEN
      expect(clusterSg).toBeDefined();

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::EC2::SecurityGroup", {
        GroupDescription: "Security group for EKS cluster",
      });
    });

    it("should create EKS node security group", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 2,
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN
      const vpcBuilder = new VPCBuilder(stack, "TestVPC", props);
      const nodeSg = vpcBuilder.createNodeSecurityGroup();

      // THEN
      expect(nodeSg).toBeDefined();

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::EC2::SecurityGroup", {
        GroupDescription: "Security group for EKS worker nodes",
      });
    });
  });

  describe("validation", () => {
    it("should throw error for invalid azCount", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 0, // Invalid
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN & THEN
      expect(() => {
        new VPCBuilder(stack, "TestVPC", props);
      }).toThrow("azCount must be between 1 and 6");
    });

    it("should throw error for invalid CIDR", () => {
      // GIVEN
      const props = {
        pattern: "public-only" as const,
        azCount: 2,
        vpcCidr: "invalid-cidr", // Invalid
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN & THEN
      expect(() => {
        new VPCBuilder(stack, "TestVPC", props);
      }).toThrow("Invalid VPC CIDR format");
    });

    it("should throw error for invalid pattern", () => {
      // GIVEN
      const props = {
        pattern: "invalid-pattern" as any, // Invalid
        azCount: 2,
        vpcCidr: "10.0.0.0/16",
        environment: "test",
        homelabType: "basic-cloud",
        enableFlowLogs: false,
      };

      // WHEN & THEN
      expect(() => {
        new VPCBuilder(stack, "TestVPC", props);
      }).toThrow("Invalid pattern");
    });
  });
});
