# IAM role + instance profile granting EC2 read-only access to ECR.
#
# Why: to pull images from ECR at boot, the EC2 instances must authenticate
# to the registry (`docker login`). Rather than hardcode AWS credentials in
# user_data, we attach an instance profile — the EC2 metadata service then
# delivers short-lived, auto-rotated credentials to the box, and the AWS CLI
# / `aws ecr get-login-password` picks them up with no secrets on disk.
#
# Read-only is sufficient: the instances only ever pull images, never push.
# Image builds/pushes happen elsewhere (CI/locally).
#
# Isolated step: this file defines the role/profile only. Attaching the
# profile to the instances is a separate, reviewed edit to main.tf.

resource "aws_iam_role" "ec2_ecr" {
  name = "${var.project_name}-ec2-ecr-role"

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
    Name = "${var.project_name}-ec2-ecr-role"
  }
}

resource "aws_iam_role_policy_attachment" "ec2_ecr_readonly" {
  role       = aws_iam_role.ec2_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "ec2_ecr" {
  name = "${var.project_name}-ec2-ecr-profile"
  role = aws_iam_role.ec2_ecr.name
}
