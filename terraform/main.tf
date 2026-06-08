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

    # Clone the monorepo and build the frontend workspace from the root
    git clone -b develop https://github.com/gidops/vms.git /opt/vms
    cd /opt/vms
    npm ci
    npx turbo run build --filter=@vms/frontend

    # Assemble the Next.js standalone bundle (monorepo layout nests the server
    # under apps/frontend) and start it on port 80.
    cp -r /opt/vms/apps/frontend/public /opt/vms/apps/frontend/.next/standalone/apps/frontend/public
    mkdir -p /opt/vms/apps/frontend/.next/standalone/apps/frontend/.next
    cp -r /opt/vms/apps/frontend/.next/static /opt/vms/apps/frontend/.next/standalone/apps/frontend/.next/static

    cd /opt/vms/apps/frontend/.next/standalone
    PORT=80 HOSTNAME=0.0.0.0 nohup node apps/frontend/server.js > /var/log/frontend.log 2>&1 &
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
    description = "Backend API"
    from_port   = 4000
    to_port     = 4000
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
    apt-get install -y curl git ca-certificates

    # Node.js 20 via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    # Clone the monorepo and install from the root. The backend's postinstall
    # runs `prisma generate` (needs only the schema, not the DB).
    git clone -b develop https://github.com/gidops/vms.git /opt/vms
    cd /opt/vms
    npm ci

    # RDS connection string — exported before any Prisma step so build and
    # migrate deploy all see it.
    export DATABASE_URL="postgres://vmsuser:${random_password.db.result}@${aws_db_instance.main.address}:5432/vmsdb"

    # Build the backend workspace (does not need the DB)
    npx turbo run build --filter=@vms/backend

    # Parse host and port out of DATABASE_URL (postgresql://user:pass@host:port/db)
    host_port_db="$${DATABASE_URL##*@}"
    host_port="$${host_port_db%%/*}"
    case "$host_port" in
      *:*)
        DB_HOST="$${host_port%%:*}"
        DB_PORT="$${host_port##*:}"
        ;;
      *)
        DB_HOST="$host_port"
        DB_PORT="5432"
        ;;
    esac

    # Wait until RDS is accepting connections before applying migrations.
    echo "Waiting for database at $${DB_HOST}:$${DB_PORT}..."
    attempts=0
    max_attempts=60
    until node -e "
    const net = require('net');
    const s = net.createConnection({ host: '$${DB_HOST}', port: $${DB_PORT}, timeout: 2000 });
    s.once('connect', () => { s.end(); process.exit(0); });
    s.once('error', () => process.exit(1));
    s.once('timeout', () => { s.destroy(); process.exit(1); });
    " >/dev/null 2>&1; do
      attempts=$((attempts + 1))
      if [ "$attempts" -ge "$max_attempts" ]; then
        echo "Database not reachable after $${max_attempts} attempts; aborting." >&2
        exit 1
      fi
      sleep 1
    done
    echo "Database reachable after $${attempts} attempt(s)."

    # Apply migrations to RDS (run from the backend workspace so Prisma finds
    # prisma/schema.prisma).
    cd /opt/vms/apps/backend
    npx prisma migrate deploy

    # Start the NestJS app on port 4000 with the RDS connection string
    PORT=4000 NODE_ENV=production DATABASE_URL=$DATABASE_URL nohup node dist/main.js > /var/log/backend.log 2>&1 &
  EOT
}

resource "aws_instance" "backend" {
  ami                         = data.aws_ami.ubuntu_2204.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.backend.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  user_data                   = local.backend_user_data

  depends_on = [aws_db_instance.main]

  tags = {
    Name = "${var.project_name}-backend"
  }
}
