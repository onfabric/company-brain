# Holds the runtime bundle (compose files, Caddyfile, db scripts) the deploy
# workflow uploads and the instance downloads. Account-id suffix for a globally
# unique name.
resource "aws_s3_bucket" "artifacts" {
  bucket = "company-brain-deploy-${data.aws_caller_identity.current.account_id}-${var.environment}"

  tags = {
    Name = "${local.resource_name_prefix}-deploy"
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "expire-old-bundles"
    status = "Enabled"
    filter {}
    expiration {
      days = 30
    }
  }
}
