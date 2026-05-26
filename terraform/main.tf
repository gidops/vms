data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "ubuntu_2204" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "frontend" {
  name        = "${var.project_name}-frontend-sg"
  description = "Allow HTTP, HTTPS, and SSH inbound to the frontend instance."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
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

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-frontend-sg"
  }
}

locals {
  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee /var/log/user-data.log) 2>&1

    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl git ca-certificates

    # Node.js 20 via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    # Clone and build the frontend
    git clone -b develop https://github.com/gidops/vms.git /opt/vms
    cd /opt/vms/frontend
    npm ci
    npm run build

    # Assemble the Next.js standalone bundle and start it on port 80
    cp -r /opt/vms/frontend/public /opt/vms/frontend/.next/standalone/public
    mkdir -p /opt/vms/frontend/.next/standalone/.next
    cp -r /opt/vms/frontend/.next/static /opt/vms/frontend/.next/standalone/.next/static

    cd /opt/vms/frontend/.next/standalone
    PORT=80 HOSTNAME=0.0.0.0 nohup node server.js > /var/log/frontend.log 2>&1 &
  EOT
}

resource "aws_instance" "frontend" {
  ami                         = data.aws_ami.ubuntu_2204.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.frontend.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  user_data                   = local.user_data

  tags = {
    Name = "${var.project_name}-frontend"
  }
}
