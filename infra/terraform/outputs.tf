output "public_ip" {
  description = "Point your Cloudflare A record (DNS only / grey cloud) at this."
  value       = aws_eip.app.public_ip
}

output "public_ipv6" {
  description = "Point your Cloudflare AAAA record (DNS only / grey cloud) at this."
  value       = one(aws_instance.app.ipv6_addresses)
}

output "hostname" {
  value = var.hostname
}

output "ecr_repository_url" {
  description = "Set as the IMAGE repo in the deploy workflow."
  value       = aws_ecr_repository.nango.repository_url
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "github_deploy_role_arn" {
  description = "Set as AWS_DEPLOY_ROLE_ARN in GitHub repo variables."
  value       = aws_iam_role.github_deploy.arn
}

output "instance_id" {
  value = aws_instance.app.id
}

output "deploy_group_tag" {
  description = "SSM targeting tag used by the deploy workflow."
  value       = "company-brain-${var.environment}"
}
