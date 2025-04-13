import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  const queueUrl = process.env.QUEUE_URL;
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(event),
  });
  await sqsClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Event queued" }),
  };
};
