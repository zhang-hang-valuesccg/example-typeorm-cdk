import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import {
  Vpc,
  SubnetType,
  SecurityGroup,
  Port,
  InstanceType,
  InstanceClass,
  InstanceSize,
  IpAddresses,
} from "aws-cdk-lib/aws-ec2";
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion,
  Credentials,
  StorageType,
} from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class TypeormcdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "typeorm-test-vpc", {
      vpcName: "typeorm-test-vpc",
      ipAddresses: IpAddresses.cidr("10.2.0.0/16"),
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "typeorm-test-subnet-public",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "typeorm-test-subnet-private",
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: 1,
    });

    const rdsSG = new SecurityGroup(this, "typeorm-rds-sg", {
      vpc,
      description: "Allow Lambda to access RDS",
      allowAllOutbound: true,
    });

    const lambdaSG = new SecurityGroup(this, "typeorm-lambda-sg", {
      vpc,
      description: "Allow Lambda to access the internet",
      allowAllOutbound: true,
    });

    rdsSG.addIngressRule(
      lambdaSG,
      Port.tcp(3306),
      "Allow Lambda to access RDS"
    );

    const dbUsername = "admin";
    const dbPassword = new Secret(this, "typeorm-rds-secret", {
      secretName: "rds-password",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: dbUsername }),
        generateStringKey: "password",
        excludePunctuation: true,
      },
    });

    const rdsInstance = new DatabaseInstance(this, "typeorm-rds-instance", {
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_8_0_35,
      }),
      vpc: vpc,
      credentials: Credentials.fromSecret(dbPassword),
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      storageType: StorageType.GP2,
      securityGroups: [rdsSG],
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Note: not recommended for production
      deletionProtection: false,
    });

    const ormFn = new NodejsFunction(this, "typeorm-lambda-orm", {
      entry: "./lambda/workload/typeorm.ts",
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      vpc: vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSG],
      bundling: {
        preCompilation: true, // enable emitdecoratormetadata
        esbuildArgs: {
          "--resolve-extensions": ".js",
        },
      },
      environment: {
        ENDPOINT: rdsInstance.instanceEndpoint.hostname,
      },
    });
    ormFn.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    rdsInstance.grantConnect(ormFn);
    dbPassword.grantRead(ormFn);

    const noOrmFn = new NodejsFunction(this, "typeorm-lambda-no-orm", {
      entry: "./lambda/workload/mysql.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      runtime: Runtime.NODEJS_20_X,
      securityGroups: [lambdaSG],
      vpc: vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: {
        ENDPOINT: rdsInstance.instanceEndpoint.hostname,
      },
    });
    noOrmFn.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    rdsInstance.grantConnect(noOrmFn);
    dbPassword.grantRead(noOrmFn);
  }
}
