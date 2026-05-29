resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_ami.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.instance.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  user_data                   = templatefile("${path.module}/user_data.sh.tftpl", {})
  user_data_replace_on_change = false

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens   = "required" # IMDSv2 only
    http_endpoint = "enabled"
  }

  tags = {
    Name = "company-brain-${var.environment}"
    # The deploy workflow targets the instance by these tags.
    DeployGroup = "company-brain-${var.environment}"
  }
}

# Stable public IP — point your Cloudflare A record at this.
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
}
