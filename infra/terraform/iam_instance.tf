data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "company-brain-${var.environment}-instance"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json
}

# SSM Session Manager + SSM RunCommand agent connectivity.
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "instance" {
  # Pull images from ECR.
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPull"
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchCheckLayerAvailability",
    ]
    resources = [aws_ecr_repository.nango.arn]
  }

  # Download the runtime bundle.
  statement {
    sid       = "ArtifactsRead"
    actions   = ["s3:GetObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.artifacts.arn, "${aws_s3_bucket.artifacts.arn}/*"]
  }

  # Read deployment secrets.
  statement {
    sid       = "SsmRead"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["${local.ssm_param_arn_prefix}/*"]
  }

  # Decrypt SecureString parameters (default aws/ssm KMS key) — scoped to SSM.
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
}

resource "aws_iam_role_policy" "instance" {
  name   = "company-brain-${var.environment}-instance"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "instance" {
  name = "company-brain-${var.environment}-instance"
  role = aws_iam_role.instance.name
}
