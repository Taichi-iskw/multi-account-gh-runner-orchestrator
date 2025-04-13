#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebhookRouterStack } from "../lib/webhook-router-stack";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const app = new cdk.App();
new WebhookRouterStack(app, "WebhookRouterStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
