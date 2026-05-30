# Secrets the instance reads at deploy time. Generated once and kept in state
# (S3 backend is encrypted + access-controlled). Do NOT taint/regenerate
# encryption_key after data exists — it decrypts everything Nango stores.

resource "random_id" "encryption_key" {
  byte_length = 32 # 32 raw bytes -> valid base64 key Nango expects
}

resource "random_password" "db" {
  length  = 32
  special = false # used inside a postgres:// URL, keep it URL-safe
}

resource "random_password" "dashboard" {
  length  = 24
  special = false
}

resource "aws_ssm_parameter" "encryption_key" {
  name  = "${var.ssm_secret_prefix}/nango_encryption_key"
  type  = "SecureString"
  value = random_id.encryption_key.b64_std
}

resource "aws_ssm_parameter" "db_password" {
  name  = "${var.ssm_secret_prefix}/nango_db_password"
  type  = "SecureString"
  value = random_password.db.result
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
