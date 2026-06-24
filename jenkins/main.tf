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

# ECR push/pull so CI can build and publish the app images. Now redundant —
# PowerUserAccess (below) already includes ECR — but left in place deliberately;
# removing an attachment is a separate cleanup that could surface ordering churn.
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.jenkins.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

# Full access to all services EXCEPT IAM/Organizations — covers the app-stack
# deploy surface (EC2, VPC, RDS, ECR, S3, DynamoDB) and remote-state access.
resource "aws_iam_role_policy_attachment" "poweruser" {
  role       = aws_iam_role.jenkins.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# PowerUser excludes IAM, but the app stack creates its own role + instance
# profile and passes the role to EC2. Scoped IAM actions to cover that lifecycle
# (incl. PassRole) without granting full IAM admin.
resource "aws_iam_role_policy" "deploy_iam" {
  name = "vms-jenkins-deploy-iam"
  role = aws_iam_role.jenkins.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:PassRole",
        "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile", "iam:GetInstanceProfile",
        "iam:AddRoleToInstanceProfile", "iam:RemoveRoleFromInstanceProfile",
        "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole",
        "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy", "iam:GetPolicyVersion",
        "iam:TagRole", "iam:TagInstanceProfile", "iam:TagPolicy"
      ]
      Resource = "*"
    }]
  })
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

  lifecycle {
    ignore_changes = [user_data]
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
    # 1. Base + Java 21 (current Jenkins LTS runtime).
    apt-get update -y
    apt-get install -y openjdk-21-jre ca-certificates curl gnupg unzip apt-transport-https lsb-release
    update-alternatives --set java /usr/lib/jvm/java-21-openjdk-amd64/bin/java
    # 2. Docker FIRST — so the `jenkins` user can be added to the `docker` group later.
    apt-get install -y docker.io
    systemctl enable --now docker
    # 3. AWS CLI v2.
    ARCH="$${ARCH:-$(uname -m)}"
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$${ARCH}.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install
    rm -rf /tmp/aws /tmp/awscliv2.zip
    # 4. Terraform — HashiCorp apt repo.
    curl -fsSL https://apt.releases.hashicorp.com/gpg \
      | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
      > /etc/apt/sources.list.d/hashicorp.list
    apt-get update -y
    apt-get install -y terraform
    # 5. Jenkins repo key — fetched from the Ubuntu keyserver by key ID. More robust
    #    than pinning a dated .key file URL, which breaks when Jenkins rotates its
    #    signing key (the NO_PUBKEY 7198F4B714ABFC68 failure we hit on rebuild).
    #    If Jenkins rotates the key again, update the ID on the two lines below.
    install -m 0755 -d /usr/share/keyrings
    JENKINS_KEY_ID="7198F4B714ABFC68"
    fetch_jenkins_key() {
      local ks
      for ks in keyserver.ubuntu.com keys.openpgp.org pgp.mit.edu; do
        for attempt in 1 2 3; do
          if gpg --batch --keyserver "$${ks}" --recv-keys "$${JENKINS_KEY_ID}"; then
            return 0
          fi
          sleep 5
        done
      done
      return 1
    }
    fetch_jenkins_key
    gpg --export "$${JENKINS_KEY_ID}" > /usr/share/keyrings/jenkins-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.gpg] https://pkg.jenkins.io/debian-stable binary/" \
      > /etc/apt/sources.list.d/jenkins.list
    apt-get update -y
    # 6. Install Jenkins, but stop it so we can seed plugins before first start.
    apt-get install -y jenkins
    systemctl stop jenkins || true
    # 7. Seed plugins with the standalone plugin-installation-manager-tool (the Debian
    #    package does not ship jenkins-plugin-cli). docker-workflow = "Docker Pipeline",
    #    needed by the Jenkinsfile's agent{docker{}}; github-branch-source = Multibranch.
    #    Non-fatal: if the download fails, Jenkins still boots and plugins can be added via UI.
    JENKINS_VERSION="$$(dpkg-query -W -f='$${Version}' jenkins | sed 's/[^0-9.]*//')"
    curl -fsSL -o /usr/local/bin/jenkins-plugin-cli.jar \
      "https://github.com/jenkinsci/plugin-installation-manager-tool/releases/download/2.13.2/jenkins-plugin-manager-2.13.2.jar" || true
    install -d -o jenkins -g jenkins /var/lib/jenkins/plugins
    java -jar /usr/local/bin/jenkins-plugin-cli.jar \
      --jenkins-version "$${JENKINS_VERSION}" \
      --plugin-download-directory /var/lib/jenkins/plugins \
      --plugins docker-workflow workflow-aggregator git github-branch-source pipeline-stage-view \
      || echo "WARN: plugin seeding failed; install plugins via the Jenkins UI after boot"
    chown -R jenkins:jenkins /var/lib/jenkins/plugins
    # 8. Grant Docker access to the jenkins user, then start Jenkins.
    usermod -aG docker jenkins
    systemctl enable jenkins
    systemctl start jenkins
  EOF
}
