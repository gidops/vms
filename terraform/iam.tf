# IAM role + instance profile for the single VMS app host.
#
# The host needs exactly four capabilities, nothing more:
#   1. Pull images from ECR at boot (read-only — builds/pushes happen in CI/locally).
#   2. Be managed via SSM Session Manager (no SSH anywhere in this design).
#   3. Ship metrics/logs via the CloudWatch agent (corporate baseline).
#   4. Read the ONE Secrets Manager secret holding its runtime secrets.
#
# Named -VMS- to avoid colliding with the hand-built Platta-NonProd-EC2-Role
# that still exists in the account; that role is deleted at manual-environment
# cleanup, after this stack is validated.

resource "aws_iam_role" "app_host" {
  name = "${var.name_prefix}-VMS-EC2-Role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.name_prefix}-VMS-EC2-Role"
  }
}

resource "aws_iam_role_policy_attachment" "ecr_readonly" {
  role       = aws_iam_role.app_host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app_host.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.app_host.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Scoped to the single app secret — not secretsmanager:* and not account-wide.
resource "aws_iam_role_policy" "read_app_secret" {
  name = "${var.name_prefix}-VMS-ReadAppSecret"
  role = aws_iam_role.app_host.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "secretsmanager:GetSecretValue"
        Resource = aws_secretsmanager_secret.app.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app_host" {
  name = "${var.name_prefix}-VMS-EC2-Profile"
  role = aws_iam_role.app_host.name
}
