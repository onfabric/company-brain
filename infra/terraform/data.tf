data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# Latest Amazon Linux 2023 x86_64 AMI (SSM agent preinstalled).
data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# Use the account's default VPC + its subnets.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  resource_name_prefix = "company-brain-${var.environment}"
  ssm_param_arn_prefix = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_secret_prefix}"
}
