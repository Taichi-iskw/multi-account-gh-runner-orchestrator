import { Webhooks } from "@octokit/webhooks";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import axios from "axios";
import { lambdaUrls } from "./url";

// Secrets Managerクライアントを作成
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
});

// webhook secret を Secrets Manager から取得する関数
async function getWebhookSecret(): Promise<string> {
  const secretId = process.env.WEBHOOK_SECRET_ARN; // Lambda環境変数にARNを渡す
  if (!secretId) {
    throw new Error("WEBHOOK_SECRET_ARN is not set");
  }

  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: secretId,
    })
  );

  if (!secretValue.SecretString) {
    throw new Error("SecretString is empty");
  }

  return secretValue.SecretString;
}

export const handler = async (event: any) => {
  if (!event.body || !event.headers || !event.headers["X-Hub-Signature-256"]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing body or signature" }),
    };
  }

  try {
    // Secrets ManagerからWebhook Secretを取得
    const webhookSecret = await getWebhookSecret();

    // Webhookモジュールをセットアップ
    const webhooks = new Webhooks({
      secret: webhookSecret,
    });

    // Webhookイベントを検証＆パース
    const verified = await webhooks.verify(
      event.body,
      event.headers["X-Hub-Signature-256"]
    );
    if (!verified) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Invalid signature" }),
      };
    }
    const payload = JSON.parse(event.body);

    // イベント内容をチェック
    if (payload.action !== "queued") {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Ignored non-queued event" }),
      };
    }

    const labels = payload.workflow_job.labels;
    const label = labels.find((label: string) => label in lambdaUrls);
    const url = label ? lambdaUrls[label] : lambdaUrls.default;
    console.log("✅", label, url);

    const repositoryName = payload.repository.name;
    const owner = payload.repository.owner.login;

    await axios.post(url, {
      repositoryName,
      owner,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "OK" }),
    };
  } catch (error) {
    console.error("Error verifying webhook or processing event:", error);
    return {
      statusCode: 401,
      body: JSON.stringify({
        message: "Invalid signature or processing error",
      }),
    };
  }
};
