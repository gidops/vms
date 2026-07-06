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
    description     = "HTTP from ALB only"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
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
    apt-get install -y docker.io awscli
    systemctl enable --now docker
    aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${aws_ecr_repository.frontend.repository_url}
    docker run -d --name vms-frontend --restart unless-stopped -p 80:3000 ${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}
  EOT
}

resource "aws_instance" "frontend" {
  ami                         = data.aws_ami.ubuntu_2204.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.frontend.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  iam_instance_profile        = aws_iam_instance_profile.ec2_ecr.name
  user_data                   = local.user_data
  # user_data runs only on first boot, so an in-place update would NOT redeploy
  # the new image. Force a replacement when user_data changes (e.g. a new tag).
  user_data_replace_on_change = true

  tags = {
    Name = "${var.project_name}-frontend"
  }
}

# -----------------------------------------------------------------------------
# Backend + RDS
# -----------------------------------------------------------------------------

# Second public subnet in a different AZ. RDS DB subnet groups require subnets
# in at least two distinct Availability Zones, so we add this even though we
# only deploy the backend EC2 into the first subnet.
resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-b"
  }
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "backend" {
  name        = "${var.project_name}-backend-sg"
  description = "Allow backend API (4000) and SSH inbound."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Backend API from ALB only"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
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
    Name = "${var.project_name}-backend-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow Postgres only from the backend security group."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from backend SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend.id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = [aws_subnet.public.id, aws_subnet.public_b.id]

  tags = {
    Name = "${var.project_name}-db-subnets"
  }
}

# Alphanumeric-only to keep the value safe inside a postgres:// URL and inside
# a bash double-quoted string in user_data.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_instance" "main" {
  identifier             = "${var.project_name}-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_type           = "gp3"
  db_name                = "vmsdb"
  username               = "vmsuser"
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  skip_final_snapshot    = true

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

locals {
  backend_user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee /var/log/user-data.log) 2>&1
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y docker.io awscli
    systemctl enable --now docker
    aws ecr get-login-password --region ${var.region} | docker login --username AWS --password-stdin ${aws_ecr_repository.backend.repository_url}
    docker run -d --name vms-backend --restart unless-stopped -p 4000:4000 \
      -e DATABASE_URL="postgres://${aws_db_instance.main.username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}" \
      -e JWT_SECRET="${random_password.jwt_secret.result}" \
      -e ENCRYPTION_KEY="${random_bytes.encryption_key.base64}" \
      -e APP_PUBLIC_URL="${var.app_public_url}" \
      -e EMAIL_ENABLED="${var.email_enabled}" \
      -e EMAIL_PROVIDER="${var.email_provider}" \
      -e EMAIL_FROM="${var.email_from}" \
      -e MAILTRAP_HOST="${var.mailtrap_host}" \
      -e MAILTRAP_PORT="${var.mailtrap_port}" \
      -e MAILTRAP_USER="${var.mailtrap_user}" \
      -e MAILTRAP_PASS="${var.mailtrap_pass}" \
      -e SENDGRID_API_KEY="${var.sendgrid_api_key}" \
      -e WHATSAPP_ENABLED="${var.whatsapp_enabled}" \
      -e WHATSAPP_PROVIDER="${var.whatsapp_provider}" \
      -e WHATSAPP_USE_TEMPLATES="${var.whatsapp_use_templates}" \
      -e TWILIO_ACCOUNT_SID="${var.twilio_account_sid}" \
      -e TWILIO_AUTH_TOKEN="${var.twilio_auth_token}" \
      -e TWILIO_WHATSAPP_FROM="${var.twilio_whatsapp_from}" \
      ${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}
  EOT
}

resource "aws_instance" "backend" {
  ami                         = data.aws_ami.ubuntu_2204.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  iam_instance_profile        = aws_iam_instance_profile.ec2_ecr.name
  user_data                   = local.backend_user_data
  # user_data runs only on first boot, so an in-place update would NOT redeploy
  # the new image. Force a replacement when user_data changes (e.g. a new tag).
  user_data_replace_on_change = true

  depends_on = [aws_db_instance.main]

  tags = {
    Name = "${var.project_name}-backend"
  }
}

resource "aws_eip_association" "backend" {
  instance_id   = aws_instance.backend.id
  allocation_id = aws_eip.backend.id
}
