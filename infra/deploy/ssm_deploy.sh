#!/usr/bin/env bash
# Runs in CI. Triggers the on-box deploy on the EC2 instance over SSM (no SSH):
# finds the box, waits until it can receive commands, runs the deploy, and
# streams the result back.
# AWS credentials come from the environment (configure-aws-credentials).
set -euo pipefail

: "${BUNDLE_URL:?}" "${DEPLOY_GROUP:?}" "${NANGO_IMAGE_URI:?}" "${BRAIN_IMAGE_URI:?}" "${SSM_SECRET_PREFIX:?}"
: "${NANGO_HOSTNAME:?}" "${NANGO_CONNECT_HOSTNAME:?}" "${BRAIN_HOSTNAME:?}" "${DOZZLE_HOSTNAME:?}" "${ACME_EMAIL:?}" "${AWS_REGION:?}"

instance_id=$(aws ec2 describe-instances \
  --filters "Name=tag:DeployGroup,Values=${DEPLOY_GROUP}" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)
if [ -z "$instance_id" ] || [ "$instance_id" = "None" ]; then
  echo "::error::No running EC2 instance found for DeployGroup=${DEPLOY_GROUP}"
  exit 1
fi
echo "Target instance: $instance_id"

# A freshly-created box isn't registered with SSM yet; wait so send-command lands.
echo "Waiting for the instance to register with SSM..."
ssm_online=false
for _ in $(seq 1 60); do
  ping=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=${instance_id}" \
    --query "InstanceInformationList[0].PingStatus" --output text 2>/dev/null || true)
  [ "$ping" = "Online" ] && { echo "SSM is Online."; ssm_online=true; break; }
  echo "  ssm ping: ${ping:-none}"; sleep 10
done
if [ "$ssm_online" != "true" ]; then
  echo "::error::Instance ${instance_id} did not register with SSM within 10 minutes"
  exit 1
fi

# The script that runs on the box. The bootstrap-marker wait ensures
# Docker/Compose/AWS CLI are installed (user_data) before we deploy onto a
# brand-new box. Config the on-box script needs is exported here (no deploy.env
# file to ship); secrets are read from SSM by the box itself. The export line is
# built with jq @sh so the values are safely shell-quoted.
exports=$(jq -rn \
  --arg image "$NANGO_IMAGE_URI" --arg brain_image "$BRAIN_IMAGE_URI" --arg prefix "$SSM_SECRET_PREFIX" --arg host "$NANGO_HOSTNAME" \
  --arg connect_host "$NANGO_CONNECT_HOSTNAME" --arg brain_host "$BRAIN_HOSTNAME" --arg dozzle_host "$DOZZLE_HOSTNAME" --arg acme "$ACME_EMAIL" --arg region "$AWS_REGION" \
  '"export NANGO_IMAGE_URI=\($image|@sh) BRAIN_IMAGE_URI=\($brain_image|@sh) SSM_SECRET_PREFIX=\($prefix|@sh) NANGO_HOSTNAME=\($host|@sh) NANGO_CONNECT_HOSTNAME=\($connect_host|@sh) BRAIN_HOSTNAME=\($brain_host|@sh) DOZZLE_HOSTNAME=\($dozzle_host|@sh) ACME_EMAIL=\($acme|@sh) AWS_DEFAULT_REGION=\($region|@sh)"')

remote_script=$(cat <<REMOTE
set -euo pipefail
timeout 600 bash -c 'until [ -f /opt/cb-bootstrap.done ]; do echo waiting for instance bootstrap; sleep 5; done'
mkdir -p /opt/company-brain
aws s3 cp "$BUNDLE_URL" /tmp/bundle.tar.gz
# Extract in place (no rm -rf) so bind-mounted dirs keep their inodes and Caddy can hot-reload without a recreate.
tar xzf /tmp/bundle.tar.gz --overwrite -C /opt/company-brain
cd /opt/company-brain
${exports}
bash on_box_deploy.sh
REMOTE
)

# Pass the whole script as a single command; jq handles the JSON encoding.
jq -n --arg script "$remote_script" '{commands: [$script]}' > /tmp/ssm-params.json
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
