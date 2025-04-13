import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { SQSHandler } from "aws-lambda";
import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const codebuildClient = new CodeBuildClient({});
const secretsManager = new SecretsManagerClient({});

const githubAppSecretName = process.env.GITHUB_APP_SECRET_NAME!;
const codebuildProjectName = process.env.CODEBUILD_PROJECT_NAME!;

// GitHub AppからJITトークンを取得する関数
async function getJitToken(owner: string, repo: string): Promise<string> {
  // Secrets ManagerからGitHub Appの情報を取得
  const secret = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: githubAppSecretName,
    })
  );

  if (!secret.SecretString) {
    throw new Error("GitHub App Secret not found");
  }

  const ghAppSecrets = JSON.parse(secret.SecretString);
  const privateKey = ghAppSecrets.PRIVATE_KEY;
  const appId = process.env.APP_ID;

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
    },
  });

  const { data: installation } = await octokit.rest.apps.getRepoInstallation({
    owner,
    repo,
  });

  // インストールトークンを使ったOctokitを作成
  const installationOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId: installation.id },
  });

  // JIT登録用のランナートークンを取得
  const { data: registrationToken } =
    await installationOctokit.rest.actions.createRegistrationTokenForRepo({
      owner,
      repo,
    });

  return registrationToken.token;
}

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);
    const payload = JSON.parse(body.body);

    const repo = payload.repositoryName;
    const owner = payload.owner;

    // GitHub APIを叩いてJITトークンを取得
    const jitToken = await getJitToken(owner, repo);

    // CodeBuildを起動してJITトークンなどを渡す
    await codebuildClient.send(
      new StartBuildCommand({
        projectName: codebuildProjectName,
        environmentVariablesOverride: [
          { name: "OWNER", value: owner, type: "PLAINTEXT" },
          { name: "REPO", value: repo, type: "PLAINTEXT" },
          { name: "JIT_TOKEN", value: jitToken, type: "PLAINTEXT" },
        ],
      })
    );
  }
};
