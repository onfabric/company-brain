# --- GitHub Actions OIDC: scoped role for the APP deploy workflow ---
#
# The OIDC provider itself and the privileged Terraform role are created by the
# one-time CloudFormation bootstrap (infra/bootstrap/), so here we only look the
# provider up and create the narrowly-scoped role the CD workflow uses.

data "aws_iam_openid_connect_provider" "github" {
  count = var.enable_github_deploy ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_assume" {
  count = var.enable_github_deploy ? 1 : 0

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github[0].arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  count = var.enable_github_deploy ? 1 : 0

  name               = "company-brain-${var.environment}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume[0].json
}

data "aws_iam_policy_document" "github_deploy" {
  count = var.enable_github_deploy ? 1 : 0

  # Push images to ECR.
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [
      aws_ecr_repository.nango.arn,
      aws_ecr_repository.brain.arn,
      aws_ecr_repository.pg_backup.arn,
    ]
  }

  # Upload the runtime bundle.
  statement {
    sid       = "ArtifactsWrite"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.artifacts.arn, "${aws_s3_bucket.artifacts.arn}/*"]
  }

  # Find the target instance behind the deploy tag.
  statement {
    sid       = "Ec2Describe"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  statement {
    sid       = "SsmReadSecrets"
    actions   = ["ssm:GetParameter"]
    resources = ["${local.ssm_param_arn_prefix}/*"]
  }

  statement {
    sid       = "KmsDecryptViaSsm"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${data.aws_region.current.name}.amazonaws.com"]
    }
  }

  # Trigger the deploy on the instance and read command status.
  statement {
    sid       = "SsmSend"
    actions   = ["ssm:SendCommand"]
    resources = ["*"]
  }
  statement {
    sid       = "SsmStatus"
    actions   = ["ssm:DescribeInstanceInformation", "ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ssm:ListCommands"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  count = var.enable_github_deploy ? 1 : 0

  name   = "company-brain-${var.environment}-github-deploy"
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}
