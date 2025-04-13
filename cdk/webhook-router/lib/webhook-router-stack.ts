import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";

export class WebhookRouterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const appId = process.env.APP_ID;
    if (!appId) {
      throw new Error("APP_ID is not set");
    }

    // GitHubのWebhookシークレットを保存するSecretsManagerリソースを作成
    const secret = new secretsmanager.Secret(this, "WebhookSecret", {
      secretName: "github-webhook-secret",
    });

    console.log(process.env.APP_ID);

    // Webhookを処理するLambda関数を作成
    const webhookHandler = new NodejsFunction(this, "WebhookHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      entry: "lambda/handler.ts",
      bundling: {
        externalModules: ["aws-sdk"],
      },
      environment: {
        SECRET_ARN: secret.secretArn,
        APP_ID: appId,
      },
    });

    // LambdaにSecretsManagerの読み取り権限を付与
    secret.grantRead(webhookHandler);

    // API Gatewayを作成
    const api = new apigateway.RestApi(this, "WebhookApi", {
      restApiName: "Webhook Router API",
      description: "API for handling GitHub webhooks",
    });

    // Lambda関数をAPI Gatewayに統合
    const integration = new apigateway.LambdaIntegration(webhookHandler);
    api.root.addMethod("POST", integration);

    // APIのエンドポイントURLを出力
    new cdk.CfnOutput(this, "WebhookRouterApiUrl", {
      value: api.url,
      description: "Webhook-Router API Endpoint URL",
    });
  }
}
