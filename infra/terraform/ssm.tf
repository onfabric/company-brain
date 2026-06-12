# Secrets the instance reads at deploy time. Generated once and kept in state
# (S3 backend is encrypted + access-controlled).

resource "random_password" "db" {
  length  = 32
  special = false # used inside a postgres:// URL, keep it URL-safe
}

resource "random_password" "brain_db" {
  length  = 32
  special = false # used inside a postgres:// URL, keep it URL-safe
}

resource "random_uuid4" "brain_api_key" {}

resource "aws_ssm_parameter" "db_password" {
  name  = "${var.ssm_secret_prefix}/nango_db_password"
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "brain_db_password" {
  name  = "${var.ssm_secret_prefix}/brain_db_password"
  type  = "SecureString"
  value = random_password.brain_db.result
}

resource "aws_ssm_parameter" "brain_api_key" {
  name  = "${var.ssm_secret_prefix}/brain_api_key"
  type  = "SecureString"
  value = random_uuid4.brain_api_key.result
}

# Dozzle simple-auth users.yml. Can't be generated here (it holds a bcrypt
# password hash), so Terraform only creates the slot; set the real value with:
#   aws ssm put-parameter --name <prefix>/dozzle_users --type SecureString \
#     --value "$(cat users.yml)" --overwrite
resource "aws_ssm_parameter" "dozzle_users" {
  name  = "${var.ssm_secret_prefix}/dozzle_users"
  type  = "SecureString"
  value = "users: {}"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "random_password" "logto_db" {
  length  = 32
  special = false # used inside a postgres:// URL, keep it URL-safe
}

resource "aws_ssm_parameter" "logto_db_password" {
  name  = "${var.ssm_secret_prefix}/logto_db_password"
  type  = "SecureString"
  value = random_password.logto_db.result
}

# Logto Management API credentials for the brain's DCR bridge and the
# logto-configure one-shot. Can't be generated here (the M2M app is created
# once in the Logto console after the first deploy), so Terraform only creates
# the slots; set the real values with:
#   aws ssm put-parameter --name <prefix>/logto_m2m_client_id --type SecureString --value <app-id> --overwrite
#   aws ssm put-parameter --name <prefix>/logto_m2m_client_secret --type SecureString --value <app-secret> --overwrite
resource "aws_ssm_parameter" "logto_m2m_client_id" {
  name  = "${var.ssm_secret_prefix}/logto_m2m_client_id"
  type  = "SecureString"
  value = "not-configured"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "logto_m2m_client_secret" {
  name  = "${var.ssm_secret_prefix}/logto_m2m_client_secret"
  type  = "SecureString"
  value = "not-configured"

  lifecycle {
    ignore_changes = [value]
  }
}
