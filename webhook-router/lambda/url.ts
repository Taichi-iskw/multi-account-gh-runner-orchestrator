const url = process.env.SAMPLE_URL!;

export const lambdaUrls: Record<string, string> = {
  default: url,
  sample: url,
};
