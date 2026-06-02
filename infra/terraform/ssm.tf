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

resource "random_password" "dashboard" {
  length  = 24
  special = false
}

resource "random_uuid" "nango_secret_key_dev" {}

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

resource "aws_ssm_parameter" "dashboard_username" {
  name  = "${var.ssm_secret_prefix}/nango_dashboard_username"
  type  = "String"
  value = "admin"
}

resource "aws_ssm_parameter" "dashboard_password" {
  name  = "${var.ssm_secret_prefix}/nango_dashboard_password"
  type  = "SecureString"
  value = random_password.dashboard.result
}

resource "aws_ssm_parameter" "nango_secret_key_dev" {
  name  = "${var.ssm_secret_prefix}/nango_secret_key_dev"
  type  = "SecureString"
  value = random_uuid.nango_secret_key_dev.result
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
