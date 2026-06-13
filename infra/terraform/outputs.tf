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

output "nango_hostname" {
  value = var.nango_hostname
}

output "nango_connect_hostname" {
  value = var.nango_connect_hostname
}

output "brain_hostname" {
  value = var.brain_hostname
}

output "dozzle_hostname" {
  value = var.dozzle_hostname
}

output "nango_ecr_repository_url" {
  description = "ECR repo for the Nango image."
  value       = aws_ecr_repository.nango.repository_url
}

output "brain_ecr_repository_url" {
  description = "ECR repo for the brain (Data Transformation Service) image."
  value       = aws_ecr_repository.brain.repository_url
}

output "pg_backup_ecr_repository_url" {
  description = "ECR repo for the nightly Postgres backup image."
  value       = aws_ecr_repository.pg_backup.repository_url
}

output "artifacts_bucket" {
  value = aws_s3_bucket.artifacts.bucket
}

output "github_deploy_role_arn" {
  description = "Set as AWS_DEPLOY_ROLE_ARN in GitHub repo variables."
  value       = var.enable_github_deploy ? aws_iam_role.github_deploy[0].arn : null
}

output "instance_id" {
  value = aws_instance.app.id
}

output "data_volume_id" {
  description = "The deploy script locates the device by this id to mount /data."
  value       = aws_ebs_volume.data.id
}

output "deploy_group_tag" {
  description = "SSM targeting tag used by the deploy workflow."
  value       = "company-brain-${var.environment}"
}
