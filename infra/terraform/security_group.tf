resource "aws_security_group" "instance" {
  name        = "company-brain-${var.environment}"
  description = "company-brain ${var.environment} instance"
  vpc_id      = data.aws_vpc.default.id

  # Public HTTPS (Caddy). Port 80 is needed for the ACME HTTP-01 challenge
  # and to redirect to HTTPS.
  ingress {
    description = "HTTP (ACME + redirect)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # No inbound SSH: shell access is via SSM Session Manager.

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
