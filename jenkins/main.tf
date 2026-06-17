# Jenkins CI server — a standalone, always-on stack, fully isolated from the app
# stack in ../terraform (its own state + provider). The app stack gets destroyed
# regularly; Jenkins must survive that, so nothing here references it.

# ---------------- Networking: reuse the account's DEFAULT VPC ----------------
# We deliberately do NOT create a VPC here — a single long-lived box doesn't need
# its own network, and reusing the default VPC keeps this stack self-contained.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ---------------- Ubuntu 22.04 AMI (same source/filters as the app stack) ----------------
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
}

# ---------------- Security group ----------------
# 8080 is the Jenkins web UI; 22 is SSH. Both are locked to a single IP on purpose:
# this box holds AWS credentials and can build/push images (and later deploy), so a
# wide-open ingress would be a direct path to the AWS account. Egress is open so the
# box can reach apt, Docker Hub, ECR, HashiCorp, etc.
resource "aws_security_group" "jenkins" {
  name        = "${var.project_name}-sg"
  description = "Jenkins UI + SSH, locked to a single IP"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Jenkins web UI"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip]
  }

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ip]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}

# ---------------- IAM: instance role + profile ----------------
resource "aws_iam_role" "jenkins" {
  name = "${var.project_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

# ECR push/pull so CI can build and publish the app images. Broader deploy perms
# (EC2/RDS/VPC for `terraform apply`) are added LATER when CD is enabled — least
# privilege for now.
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.jenkins.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

resource "aws_iam_instance_profile" "jenkins" {
  name = "${var.project_name}-profile"
  role = aws_iam_role.jenkins.name
}

# ---------------- EC2 instance ----------------
resource "aws_instance" "jenkins" {
  ami                         = data.aws_ami.ubuntu_2204.id
  instance_type               = var.instance_type
  subnet_id                   = data.aws_subnets.default.ids[0] # first default subnet
  associate_public_ip_address = true
  key_name                    = var.key_name
  vpc_security_group_ids      = [aws_security_group.jenkins.id]
  iam_instance_profile        = aws_iam_instance_profile.jenkins.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  user_data = local.user_data

  tags = {
    Name = var.project_name
  }
}

# ---------------- Stable public address ----------------
resource "aws_eip" "jenkins" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}

resource "aws_eip_association" "jenkins" {
  instance_id   = aws_instance.jenkins.id
  allocation_id = aws_eip.jenkins.id
}

# ---------------- First-boot provisioning ----------------
# $${...} escapes shell variables so Terraform's heredoc interpolation leaves them
# for bash. All output is teed to /var/log/user-data.log for debugging the boot.
locals {
  user_data = <<-EOF
    #!/usr/bin/env bash
    set -euxo pipefail
    exec > >(tee -a /var/log/user-data.log) 2>&1

    export DEBIAN_FRONTEND=noninteractive

    # 1. Base + Java 17 (Jenkins LTS runtime)
    apt-get update -y
    apt-get install -y openjdk-17-jre ca-certificates curl gnupg unzip apt-transport-https

    # 2. Jenkins LTS — official Debian-stable apt repo
    install -m 0755 -d /usr/share/keyrings
    curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key \
      | tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
    echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
      > /etc/apt/sources.list.d/jenkins.list
    apt-get update -y
    apt-get install -y jenkins

    # 3. Docker — lets Jenkins build images. Adding the `jenkins` user to the
    #    `docker` group is effectively root on this box, which is exactly why the
    #    security group is locked to a single IP.
    apt-get install -y docker.io
    usermod -aG docker jenkins
    systemctl enable --now docker

    # 4. AWS CLI v2 — official zip installer (apt ships v1, which is too old).
    ARCH="$${ARCH:-$(uname -m)}"
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$${ARCH}.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/aws /tmp/awscliv2.zip

    # 5. Terraform — HashiCorp's official apt repo.
    curl -fsSL https://apt.releases.hashicorp.com/gpg \
      | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/hashicorp.list
    apt-get update -y
    apt-get install -y terraform

    # 6. Start Jenkins (after docker group membership is set).
    systemctl enable --now jenkins
  EOF
}
