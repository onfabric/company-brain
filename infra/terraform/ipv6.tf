# Amazon-provided /56 for the default VPC, so the instance can get a public IPv6.
resource "aws_vpc_ipv6_cidr_block_association" "default" {
  vpc_id = data.aws_vpc.default.id
}

# AZ of the subnet the instance already runs in. Adopting the default subnet by
# this AZ targets that exact subnet, so the instance's subnet_id never changes
# (no replacement).
data "aws_subnet" "app" {
  id = data.aws_subnets.default.ids[0]
}

# A subnet's IPv6 CIDR can only be set on the subnet resource itself, so the
# default subnet has to be managed to carve a /64 out of the VPC's /56.
resource "aws_default_subnet" "app" {
  availability_zone               = data.aws_subnet.app.availability_zone
  ipv6_cidr_block                 = cidrsubnet(aws_vpc_ipv6_cidr_block_association.default.ipv6_cidr_block, 8, 0)
  assign_ipv6_address_on_creation = true
}

data "aws_internet_gateway" "default" {
  filter {
    name   = "attachment.vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# No explicit association on a default subnet → this resolves to the VPC main table.
data "aws_route_table" "app" {
  subnet_id = aws_default_subnet.app.id
}

# Default IPv6 route to the internet gateway (not added automatically on default VPCs).
resource "aws_route" "ipv6_default" {
  route_table_id              = data.aws_route_table.app.id
  destination_ipv6_cidr_block = "::/0"
  gateway_id                  = data.aws_internet_gateway.default.id
}
