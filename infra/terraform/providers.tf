provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "company-brain"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
