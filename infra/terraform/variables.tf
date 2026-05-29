variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "instance_type" {
  type    = string
  default = "t3.large"
}

variable "root_volume_size" {
  type        = number
  default     = 50
  description = "Root EBS volume size in GB. Holds the OS and all Docker volumes (Postgres/ES/Redis)."
}

variable "hostname" {
  type        = string
  description = "Public hostname served over HTTPS by Caddy. You add this A record in Cloudflare (DNS only / grey cloud)."
  default     = "nango-dev.onfabric.io"
}

variable "github_repo" {
  type        = string
  description = "owner/repo allowed to assume the deploy role via OIDC."
  default     = "onfabric/company-brain"
}

variable "github_branch" {
  type        = string
  description = "Branch allowed to deploy."
  default     = "main"
}

# Names of the SecureString parameters you create out-of-band (see deploy guide).
# Terraform only grants the instance permission to read this path; it never
# stores the secret values, so they stay out of state.
variable "ssm_secret_prefix" {
  type    = string
  default = "/company-brain/dev"
}
