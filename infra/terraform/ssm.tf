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

resource "random_password" "better_auth_secret" {
  length  = 48
  special = false
}

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

resource "aws_ssm_parameter" "better_auth_secret" {
  name  = "${var.ssm_secret_prefix}/better_auth_secret"
  type  = "SecureString"
  value = random_password.better_auth_secret.result
}

# Google OAuth client credentials for the brain's in-process better-auth server.
# Can't be generated here: create the OAuth client in the Google Cloud console
# (authorized redirect URI https://<brain-hostname>/api/auth/callback/google),
# then fill both slots with:
#   aws ssm put-parameter --name <prefix>/google_client_id --type SecureString \
#     --value "<client-id>" --overwrite
#   aws ssm put-parameter --name <prefix>/google_client_secret --type SecureString \
#     --value "<client-secret>" --overwrite
resource "aws_ssm_parameter" "google_client_id" {
  name  = "${var.ssm_secret_prefix}/google_client_id"
  type  = "SecureString"
  value = "unset"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "google_client_secret" {
  name  = "${var.ssm_secret_prefix}/google_client_secret"
  type  = "SecureString"
  value = "unset"

  lifecycle {
    ignore_changes = [value]
  }
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
