#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GhRunnerStack } from '../lib/gh-runner-stack';

const app = new cdk.App();
new GhRunnerStack(app, 'GhRunnerStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});