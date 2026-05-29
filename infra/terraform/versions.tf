terraform {
  required_version = ">= 1.11"

  backend "s3" {
    bucket       = "company-brain-tfstate"
    key          = "company-brain/dev/terraform.tfstate"
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true # native S3 state locking (no DynamoDB table needed)
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
