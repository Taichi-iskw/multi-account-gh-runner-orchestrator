import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { createRunnerProject } from "./codebuild-runner";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";

export class GhRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const appId = process.env.APP_ID;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!appId || !webhookSecret) {
      throw new Error(".env file is not set");
    }

    // Vpc
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 1,
      natGateways: 1,
    });

    // SecretsManager
    const githubAppSecret = new secretsmanager.Secret(this, "GitHubAppSecret", {
      secretObjectValue: {
        WEBHOOK_SECRET: cdk.SecretValue.unsafePlainText(webhookSecret),
        PRIVATE_KEY: cdk.SecretValue.unsafePlainText(""),
      },
    });

    // SQS Queue
    const queue = new sqs.Queue(this, "WebhookQueue", {
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // Lambda1: Webhook受信 → SQSへ
    const eventQueuerLambda = new NodejsFunction(this, "EventQueuerLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "lambda/event-queuer/handler.ts",
      handler: "handler",
      environment: {
        QUEUE_URL: queue.queueUrl,
        GITHUB_APP_SECRET_ARN: githubAppSecret.secretArn,
        APP_ID: appId,
      },
      bundling: {
        externalModules: ["aws-sdk"],
      },
    });
    queue.grantSendMessages(eventQueuerLambda);

    // API GatewayでWebhook受信
    const api = new apigateway.RestApi(this, "WebhookAPI");
    const queuerIntegration = new apigateway.LambdaIntegration(
      eventQueuerLambda
    );
    api.root.addMethod("POST", queuerIntegration);

    // CodeBuild Project (Self Hosted Runner)
    const runnerProject = createRunnerProject(this, vpc);

    // Lambda2: SQS → GitHub JITトークン取得 → CodeBuild起動
    const runnerDispatcherLambda = new NodejsFunction(
      this,
      "RunnerDispatcherLambda",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: "lambda/runner-dispatcher/handler.ts",
        handler: "handler",
        environment: {
          GITHUB_APP_SECRET_NAME: githubAppSecret.secretName,
          CODEBUILD_PROJECT_NAME: runnerProject.projectName,
          APP_ID: appId,
        },
        bundling: {
          externalModules: ["aws-sdk"],
        },
        timeout: cdk.Duration.minutes(5),
      }
    );
    runnerDispatcherLambda.addEventSource(
      new eventSources.SqsEventSource(queue)
    );

    // Grant permissions to start CodeBuild projects
    runnerDispatcherLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["codebuild:StartBuild"],
        resources: [runnerProject.projectArn],
      })
    );

    // Grant permissions to get secrets
    runnerDispatcherLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [githubAppSecret.secretArn],
      })
    );
  }
}
