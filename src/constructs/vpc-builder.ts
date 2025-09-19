import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { generateResourceName, generateStandardTags } from "../utils";

export interface VPCBuilderProps {
  /**
   * Networking pattern to use
   */
  pattern: "public-only" | "private-nat" | "vpc-endpoints";

  /**
   * Number of availability zones
   */
  azCount: number;

  /**
   * VPC CIDR block
   */
  vpcCidr: string;

  /**
   * Environment name
   */
  environment: string;

  /**
   * Homelab type
   */
  homelabType: string;

  /**
   * Enable VPC Flow Logs
   */
  enableFlowLogs: boolean;

  /**
   * Cost optimization settings
   */
  costOptimized?: boolean;

  /**
   * Additional tags
   */
  additionalTags?: Record<string, string>;
}

export interface VPCBuilderOutput {
  vpc: ec2.Vpc;
  publicSubnets: ec2.ISubnet[];
  privateSubnets: ec2.ISubnet[];
  isolatedSubnets: ec2.ISubnet[];
  natGateways?: ec2.CfnNatGateway[];
  vpcEndpoints?: ec2.InterfaceVpcEndpoint[];
  flowLogsGroup?: logs.LogGroup;
}

/**
 * VPCBuilder construct for creating flexible networking patterns
 */
export class VPCBuilder extends Construct {
  public readonly output: VPCBuilderOutput;

  constructor(scope: Construct, id: string, props: VPCBuilderProps) {
    super(scope, id);

    // Validate props
    this.validateProps(props);

    // Generate resource name and tags
    const vpcName = generateResourceName("admiral", props.environment, "vpc");
    const tags = generateStandardTags(
      props.environment,
      props.homelabType,
      props.additionalTags,
    );

    // Create VPC based on pattern
    const vpcConfig = this.getVpcConfiguration(props);

    const vpc = new ec2.Vpc(this, "VPC", {
      vpcName,
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      maxAzs: props.azCount,
      ...vpcConfig,
    });

    // Apply tags to VPC
    Object.entries(tags).forEach(([key, value]) => {
      vpc.node.addMetadata(key, value);
    });

    // Set up VPC endpoints if using vpc-endpoints pattern
    let vpcEndpoints: ec2.InterfaceVpcEndpoint[] | undefined;
    if (props.pattern === "vpc-endpoints") {
      vpcEndpoints = this.createVpcEndpoints(vpc, props);
    }

    // Set up VPC Flow Logs if enabled
    let flowLogsGroup: logs.LogGroup | undefined;
    if (props.enableFlowLogs) {
      flowLogsGroup = this.createFlowLogs(vpc, props);
    }

    // Prepare output
    this.output = {
      vpc,
      publicSubnets: vpc.publicSubnets,
      privateSubnets: vpc.privateSubnets,
      isolatedSubnets: vpc.isolatedSubnets,
      natGateways: this.getNatGateways(vpc),
      vpcEndpoints,
      flowLogsGroup,
    };
  }

  private validateProps(props: VPCBuilderProps): void {
    if (props.azCount < 1 || props.azCount > 6) {
      throw new Error("azCount must be between 1 and 6");
    }

    if (!props.vpcCidr.match(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/)) {
      throw new Error("Invalid VPC CIDR format");
    }

    const validPatterns = ["public-only", "private-nat", "vpc-endpoints"];
    if (!validPatterns.includes(props.pattern)) {
      throw new Error(
        `Invalid pattern. Must be one of: ${validPatterns.join(", ")}`,
      );
    }
  }

  private getVpcConfiguration(props: VPCBuilderProps): Partial<ec2.VpcProps> {
    switch (props.pattern) {
      case "public-only":
        return {
          subnetConfiguration: [
            {
              cidrMask: 24,
              name: "Public",
              subnetType: ec2.SubnetType.PUBLIC,
            },
          ],
          natGateways: 0, // No NAT gateways for cost optimization
        };

      case "private-nat":
        return {
          subnetConfiguration: [
            {
              cidrMask: 24,
              name: "Public",
              subnetType: ec2.SubnetType.PUBLIC,
            },
            {
              cidrMask: 24,
              name: "Private",
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
          ],
          natGateways: props.costOptimized ? 1 : props.azCount, // Single NAT for cost optimization
        };

      case "vpc-endpoints":
        return {
          subnetConfiguration: [
            {
              cidrMask: 24,
              name: "Public",
              subnetType: ec2.SubnetType.PUBLIC,
            },
            {
              cidrMask: 24,
              name: "Private",
              subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
          ],
          natGateways: 0, // Use VPC endpoints instead of NAT
        };

      default:
        throw new Error(`Unsupported pattern: ${props.pattern}`);
    }
  }

  private createVpcEndpoints(
    vpc: ec2.Vpc,
    props: VPCBuilderProps,
  ): ec2.InterfaceVpcEndpoint[] {
    const endpoints: ec2.InterfaceVpcEndpoint[] = [];

    // Essential VPC endpoints for EKS and ECR
    const interfaceServices = [
      { name: "ec2", service: ec2.InterfaceVpcEndpointAwsService.EC2 },
      { name: "ecr-api", service: ec2.InterfaceVpcEndpointAwsService.ECR },
      {
        name: "ecr-dkr",
        service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      },
      {
        name: "logs",
        service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      },
      { name: "sts", service: ec2.InterfaceVpcEndpointAwsService.STS },
      {
        name: "elb",
        service: ec2.InterfaceVpcEndpointAwsService.ELASTIC_LOAD_BALANCING,
      },
      {
        name: "autoscaling",
        service: ec2.InterfaceVpcEndpointAwsService.AUTOSCALING,
      },
    ];

    // S3 Gateway endpoint
    new ec2.GatewayVpcEndpoint(this, "S3Endpoint", {
      vpc,
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Interface endpoints
    interfaceServices.forEach(({ name, service }) => {
      const endpoint = new ec2.InterfaceVpcEndpoint(this, `${name}Endpoint`, {
        vpc,
        service,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        privateDnsEnabled: true,
      });

      endpoints.push(endpoint);
    });

    return endpoints;
  }

  private createFlowLogs(vpc: ec2.Vpc, props: VPCBuilderProps): logs.LogGroup {
    const logGroupName = generateResourceName(
      "admiral",
      props.environment,
      "vpc-flow-logs",
    );

    const logGroup = new logs.LogGroup(this, "FlowLogsGroup", {
      logGroupName,
      retention: logs.RetentionDays.ONE_WEEK, // Cost optimization
    });

    new ec2.FlowLog(this, "VpcFlowLog", {
      resourceType: ec2.FlowLogResourceType.fromVpc(vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    return logGroup;
  }

  private getNatGateways(vpc: ec2.Vpc): ec2.CfnNatGateway[] | undefined {
    // This is a simplified approach - in practice, you'd need to access the NAT gateways
    // created by the VPC construct, which isn't directly exposed
    // For now, we'll return undefined and document this limitation
    return undefined;
  }

  /**
   * Get security group for EKS cluster
   */
  public createEksSecurityGroup(): ec2.SecurityGroup {
    const sgName = generateResourceName("admiral", "eks", "cluster-sg");

    const securityGroup = new ec2.SecurityGroup(
      this,
      "EksClusterSecurityGroup",
      {
        vpc: this.output.vpc,
        description: "Security group for EKS cluster",
        securityGroupName: sgName,
      },
    );

    // Allow HTTPS traffic for EKS API server
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS access to EKS API server",
    );

    return securityGroup;
  }

  /**
   * Get security group for EKS nodes
   */
  public createNodeSecurityGroup(): ec2.SecurityGroup {
    const sgName = generateResourceName("admiral", "eks", "node-sg");

    const securityGroup = new ec2.SecurityGroup(this, "EksNodeSecurityGroup", {
      vpc: this.output.vpc,
      description: "Security group for EKS worker nodes",
      securityGroupName: sgName,
    });

    // Allow all traffic between nodes
    securityGroup.addIngressRule(
      securityGroup,
      ec2.Port.allTraffic(),
      "Allow all traffic between worker nodes",
    );

    // Allow traffic from cluster security group
    const clusterSg = this.createEksSecurityGroup();
    securityGroup.addIngressRule(
      clusterSg,
      ec2.Port.allTraffic(),
      "Allow traffic from EKS cluster",
    );

    return securityGroup;
  }
}
