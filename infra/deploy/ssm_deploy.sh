#!/usr/bin/env bash
# Runs in CI. Triggers the on-box deploy on the EC2 instance over SSM (no SSH):
# finds the box, waits until it can receive commands, runs the deploy, and
# streams the result back. Required env (set by the deploy workflow):
#   BUCKET DEPLOY_GROUP IMAGE_URI SSM_SECRET_PREFIX NANGO_HOSTNAME ACME_EMAIL AWS_REGION
# AWS credentials come from the environment (configure-aws-credentials).
set -euo pipefail

: "${BUCKET:?}" "${DEPLOY_GROUP:?}" "${IMAGE_URI:?}" "${SSM_SECRET_PREFIX:?}"
: "${NANGO_HOSTNAME:?}" "${ACME_EMAIL:?}" "${AWS_REGION:?}"

instance_id=$(aws ec2 describe-instances \
  --filters "Name=tag:DeployGroup,Values=${DEPLOY_GROUP}" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)
echo "Target instance: $instance_id"

# A freshly-created box isn't registered with SSM yet; wait so send-command lands.
echo "Waiting for the instance to register with SSM..."
for _ in $(seq 1 60); do
  ping=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=${instance_id}" \
    --query "InstanceInformationList[0].PingStatus" --output text 2>/dev/null || true)
  [ "$ping" = "Online" ] && { echo "SSM is Online."; break; }
  echo "  ssm ping: ${ping:-none}"; sleep 10
done

# Build the on-box command with jq so quoting is never an issue. The first step
# waits for the bootstrap marker so we never deploy before Docker/Compose/AWS CLI
# are installed on a brand-new box. Config the on-box script needs is exported
# here (no deploy.env file to ship). Secrets are read from SSM by the box itself.
jq -n \
  --arg bucket "$BUCKET" --arg image "$IMAGE_URI" --arg prefix "$SSM_SECRET_PREFIX" \
  --arg host "$NANGO_HOSTNAME" --arg acme "$ACME_EMAIL" --arg region "$AWS_REGION" \
  '{commands: [
    "set -euo pipefail",
    "timeout 600 bash -c \"until [ -f /opt/cb-bootstrap.done ]; do echo waiting for instance bootstrap; sleep 5; done\"",
    "rm -rf /opt/company-brain && mkdir -p /opt/company-brain",
    "aws s3 cp s3://\($bucket)/dev/latest.tar.gz /tmp/bundle.tar.gz",
    "tar xzf /tmp/bundle.tar.gz -C /opt/company-brain",
    "cd /opt/company-brain",
    "export IMAGE_URI=\($image|@sh) SSM_SECRET_PREFIX=\($prefix|@sh) NANGO_HOSTNAME=\($host|@sh) ACME_EMAIL=\($acme|@sh) AWS_DEFAULT_REGION=\($region|@sh)",
    "bash on_box_deploy.sh"
  ]}' > /tmp/ssm-params.json

cmd_id=$(aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --comment "Deploy ${GITHUB_SHA:-manual}" \
  --instance-ids "$instance_id" \
  --parameters file:///tmp/ssm-params.json \
  --query "Command.CommandId" --output text)
echo "SSM command: $cmd_id"

# RunCommand is async, and a full deploy (image pulls + compose up) can run for
# several minutes — longer than the built-in `ssm wait command-executed` allows
# (~100s) — so poll until the invocation reaches a terminal state.
echo "Waiting for the deploy command to finish (up to ~15m)..."
status="Pending"
for _ in $(seq 1 90); do
  status=$(aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$instance_id" \
    --query Status --output text 2>/dev/null || echo "Pending")
  case "$status" in Success|Failed|Cancelled|TimedOut) break ;; esac
  sleep 10
done

echo "Status: $status"
aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$instance_id" \
  --query StandardOutputContent --output text || true
if [ "$status" != "Success" ]; then
  echo "::error::Deploy command did not succeed (status: $status)"
  aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$instance_id" \
    --query StandardErrorContent --output text || true
  exit 1
fi
