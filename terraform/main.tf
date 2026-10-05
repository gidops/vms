# ---------------------------------------------------------------------------
# main.tf — Platta Non-Prod Dev environment for the VMS.
#
# Implements the corporate network design from the approved infrastructure
# summary VERBATIM (names, CIDRs, AZs), as code:
#
#   Platta-NonProd-VPC 10.20.0.0/16 (Dev uses 10.20.0.0/20)
#     Public  A/B  10.20.0.0/24, 10.20.1.0/24   — ALB + NAT only
#     App     A/B  10.20.2.0/24, 10.20.3.0/24   — private; single Docker host
#     DB      A/B  10.20.4.0/24, 10.20.5.0/24   — private; RDS, no internet route
#
# Topology decisions (agreed):
#   - ONE app host (t3.small, Amazon Linux 2023) runs BOTH containers:
#     frontend (host 80 → container 3000) and backend (4000). The ALB targets
#     the same instance on both ports via two target groups (alb.tf).
#   - No SSH anywhere: operator access is SSM Session Manager (iam.tf).
#   - Outbound (ECR pulls, Secrets Manager, SSM) flows through the NAT gateway.
# ---------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

# Amazon Linux 2023, standard (not minimal) x86_64 — matches the corporate
# host build. AWS CLI v2 ships preinstalled; docker + jq come from dnf.
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
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

# ---------------- VPC + subnets (documented design, verbatim) ----------------

resource "aws_vpc" "main" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.name_prefix}-VPC"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.name_prefix}-IGW"
  }
}

resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.0.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]
  # Deliberate: instances launched here get public IPs (nothing app-related
  # ever launches here — this tier is for the ALB and NAT gateway only).
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-${var.env}-Public-A"
  }
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.20.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-${var.env}-Public-B"
  }
}

resource "aws_subnet" "app_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${var.name_prefix}-${var.env}-Private-App-A"
  }
}

resource "aws_subnet" "app_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.3.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${var.name_prefix}-${var.env}-Private-App-B"
  }
}

resource "aws_subnet" "db_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.4.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${var.name_prefix}-${var.env}-DB-A"
  }
}

resource "aws_subnet" "db_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.20.5.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${var.name_prefix}-${var.env}-DB-B"
  }
}

# ---------------- NAT gateway (private tier's outbound path) ----------------

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-NAT-EIP"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id

  tags = {
    Name = "${var.name_prefix}-NAT"
  }

  depends_on = [aws_internet_gateway.main]
}

# ---------------- Route tables (documented three-tier routing) ----------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.name_prefix}-Public-RT"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.name_prefix}-Private-RT"
  }
}

# Local VPC route only — the DB tier has no path to or from the internet.
resource "aws_route_table" "db" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.name_prefix}-DB-RT"
  }
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "app_a" {
  subnet_id      = aws_subnet.app_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "app_b" {
  subnet_id      = aws_subnet.app_b.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "db_a" {
  subnet_id      = aws_subnet.db_a.id
  route_table_id = aws_route_table.db.id
}

resource "aws_route_table_association" "db_b" {
  subnet_id      = aws_subnet.db_b.id
  route_table_id = aws_route_table.db.id
}

# ---------------- Security groups (layered: ALB → app → DB) ----------------
# The ALB SG lives in alb.tf next to the ALB. App and DB SGs here.

resource "aws_security_group" "app" {
  name        = "${var.name_prefix}-App-SG"
  description = "App host: frontend (80) and backend (4000) reachable from the ALB only. No SSH - SSM."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Frontend from ALB only"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Backend API from ALB only"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All outbound (ECR, Secrets Manager, SSM via NAT)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-App-SG"
  }
}

resource "aws_security_group" "db" {
  name        = "${var.name_prefix}-DB-SG"
  description = "Postgres reachable from the app security group only."
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from app SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-DB-SG"
  }
}

# ---------------- RDS PostgreSQL (dev: single-AZ) ----------------

resource "aws_db_subnet_group" "main" {
  name       = lower("${var.name_prefix}-${var.env}-db-subnets")
  subnet_ids = [aws_subnet.db_a.id, aws_subnet.db_b.id]

  tags = {
    Name = "${var.name_prefix}-${var.env}-DB-Subnets"
  }
}

resource "aws_db_instance" "main" {
  identifier             = lower("${var.name_prefix}-${var.env}-vms-postgres")
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t3.micro"
  allocated_storage      = 20
  storage_type           = "gp3"
  db_name                = "vmsdb"
  username               = "vmsuser"
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  # Dev only: disposable data, fast teardown. Staging/prod get final snapshots,
  # deletion protection and Multi-AZ per the approved architecture plan.
  skip_final_snapshot = true

  tags = {
    Name = "${var.name_prefix}-${var.env}-VMS-Postgres"
  }
}

# ---------------- The single app host (Amazon Linux 2023 Docker host) --------

locals {
  # APP_PUBLIC_URL: explicit var wins; otherwise derive from the ALB (dev has
  # no domain yet). Also the browser-facing API base the frontend was baked
  # with rides on the same ALB, port 8080 (see alb.tf).
  app_public_url = var.app_public_url != "" ? var.app_public_url : "http://${aws_lb.main.dns_name}"

  # AL2023 bootstrap. AWS CLI v2 is preinstalled; docker + jq via dnf.
  # Secrets are FETCHED at boot from Secrets Manager (instance role grants
  # GetSecretValue on this one secret) — never interpolated into user_data.
  # NOTE for maintainers: $VAR is shell, $${...} would be shell-brace — avoid;
  # ${...} is Terraform interpolation.
  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee /var/log/user-data.log) 2>&1

    dnf install -y docker jq
    systemctl enable --now docker

    aws ecr get-login-password --region ${var.region} \
      | docker login --username AWS --password-stdin ${aws_ecr_repository.backend.repository_url}

    SECRET_JSON=$(aws secretsmanager get-secret-value \
      --secret-id ${aws_secretsmanager_secret.app.arn} \
      --region ${var.region} --query SecretString --output text)
    JWT_SECRET=$(echo "$SECRET_JSON" | jq -r .JWT_SECRET)
    ENCRYPTION_KEY=$(echo "$SECRET_JSON" | jq -r .ENCRYPTION_KEY)
    DB_PASSWORD=$(echo "$SECRET_JSON" | jq -r .DB_PASSWORD)

    docker run -d --name vms-backend --restart unless-stopped -p 4000:4000 \
      -e DATABASE_URL="postgres://${aws_db_instance.main.username}:$DB_PASSWORD@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}" \
      -e JWT_SECRET="$JWT_SECRET" \
      -e ENCRYPTION_KEY="$ENCRYPTION_KEY" \
      -e APP_PUBLIC_URL="${local.app_public_url}" \
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

    docker run -d --name vms-frontend --restart unless-stopped -p 80:3000 \
      ${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}
  EOT
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.app_a.id
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = false
  iam_instance_profile        = aws_iam_instance_profile.app_host.name
  user_data                   = local.user_data
  # user_data runs only on first boot, so an in-place update would NOT redeploy
  # a new image. Force a replacement when user_data changes (e.g. a new tag).
  user_data_replace_on_change = true

  # user_data needs the internet (dnf, ECR, Secrets Manager) on FIRST boot, and
  # it runs exactly once. Without this, Terraform may create the instance before
  # the private subnet's NAT route exists (the instance has no direct dependency
  # on it) and the bootstrap dies with no network. Learned the hard way.
  depends_on = [aws_route_table_association.app_a]

  tags = {
    Name = "${var.name_prefix}-${var.env}-App-01"
  }
}
