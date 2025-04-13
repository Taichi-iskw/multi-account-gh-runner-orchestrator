import * as codebuild from "aws-cdk-lib/aws-codebuild";
import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export function createRunnerProject(
  scope: Construct,
  vpc: ec2.IVpc
): codebuild.Project {
  const runnerLabel = process.env.RUNNER_LABEL;
  if (!runnerLabel) {
    throw new Error("AWS_RUNNER_LABEL is not set");
  }

  const runnerProject = new codebuild.Project(scope, "ghRunnberProject", {
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      privileged: true,
      computeType: codebuild.ComputeType.SMALL,
    },
    environmentVariables: {
      RUNNER_LABEL: {
        value: runnerLabel,
      },
    },
    timeout: Duration.minutes(10),
    vpc: vpc,
    subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    buildSpec: codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: [
            "echo Installing GitHub Actions Runner...",
            "mkdir actions-runner",
            "curl -o actions-runner/runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.316.0/actions-runner-linux-x64-2.316.0.tar.gz",
            "tar xzf actions-runner/runner.tar.gz -C actions-runner",
            "chmod +x actions-runner/config.sh actions-runner/run.sh",

            "echo Creating runner-user...",
            "useradd -m runner-user",
            "groupadd docker || true",
            "usermod -aG docker runner-user",

            "chown -R runner-user:docker actions-runner",
            "chmod -R g+rw actions-runner",

            "chown root:docker /var/run/docker.sock || true",
            "chmod 666 /var/run/docker.sock || true",
          ],
        },
        build: {
          commands: [
            "echo Configuring runner...",
            'su runner-user -c "cd actions-runner && ./config.sh --url https://github.com/$OWNER/$REPO --token $JIT_TOKEN --labels $RUNNER_LABEL --unattended --ephemeral"',
            'su runner-user -c "cd actions-runner && ./run.sh"',
          ],
        },
      },
    }),
  });

  return runnerProject;
}
