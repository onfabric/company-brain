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
  description = "Root EBS volume size in GB. Holds the OS only; data lives on the data volume."
}

variable "data_volume_size" {
  type        = number
  default     = 50
  description = "Persistent data EBS volume size in GB. Backs the data-bearing compose volumes (Postgres/ES/Caddy certs). Survives instance replacement."
}

variable "hostname" {
  type        = string
  description = "Public hostname served over HTTPS by Caddy. You add this A record in Cloudflare (DNS only / grey cloud)."
  default     = "nango-dev.onfabric.io"
}

variable "nango_hostname" {
  type        = string
  description = "Public hostname for the Nango dashboard/API."
  default     = "nango-dev.onfabric.io"
}

variable "nango_connect_hostname" {
  type        = string
  description = "Public hostname for the Nango Connect UI."
  default     = "nango-auth-dev.onfabric.io"
}

variable "brain_hostname" {
  type        = string
  description = "Public hostname for the Company Brain service."
  default     = "brain-dev.onfabric.io"
}

variable "dozzle_hostname" {
  type        = string
  description = "Public hostname for Dozzle logs."
  default     = "dozzle-dev.onfabric.io"
}

variable "enable_github_deploy" {
  type        = bool
  description = "Create the GitHub Actions OIDC deploy role. Local AWS CLI deployments do not need it."
  default     = false
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

variable "ssm_secret_prefix" {
  type    = string
  default = "/company-brain/dev"
}

# Google OAuth client for the brain's better-auth Google sign-in. Google exposes
# no API to create the client, so the values are produced once in the Google
# Cloud console and fed in from GitHub Actions (CD passes them as TF_VAR_*).
variable "google_client_id" {
  type        = string
  description = "Public Google OAuth client ID; GitHub Actions variable BACKEND_BETTER_AUTH_GOOGLE_CLIENT_ID."
}

variable "google_client_secret" {
  type        = string
  sensitive   = true
  description = "Google OAuth client secret; GitHub Actions secret BACKEND_BETTER_AUTH_GOOGLE_CLIENT_SECRET."
}
