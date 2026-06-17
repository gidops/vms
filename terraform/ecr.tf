# ECR repositories for the VMS monorepo.
#
# Rationale: pull-not-build. We're reworking the Terraform to deploy the
# Turborepo monorepo by having EC2 pull prebuilt Docker images from ECR at
# boot, instead of cloning the source and building on the instance. A
# t2.micro does not have enough memory to build the Next.js + turbo image
# and OOMs partway through. Building images elsewhere (CI/locally) and
# pushing them here keeps the instance boot fast and reliable.
#
# This file is intentionally isolated to ECR repos only — instance/IAM/
# user_data changes that consume these repos come in a later step.

resource "aws_ecr_repository" "backend" {
  name = "${var.project_name}-backend"

  # MUTABLE so we can re-push :latest while iterating on the image during
  # this rework. Production would use IMMUTABLE to guarantee a tag always
  # points at the same digest.
  image_tag_mutability = "MUTABLE"

  # force_delete so `terraform destroy` can remove the repository even when
  # it still contains pushed images; otherwise destroy fails on a non-empty
  # repo and requires manual cleanup.
  force_delete = true

  tags = {
    Name = "${var.project_name}-backend"
  }
}

resource "aws_ecr_repository" "frontend" {
  name = "${var.project_name}-frontend"

  # MUTABLE so we can re-push :latest while iterating on the image during
  # this rework. Production would use IMMUTABLE to guarantee a tag always
  # points at the same digest.
  image_tag_mutability = "MUTABLE"

  # force_delete so `terraform destroy` can remove the repository even when
  # it still contains pushed images; otherwise destroy fails on a non-empty
  # repo and requires manual cleanup.
  force_delete = true

  tags = {
    Name = "${var.project_name}-frontend"
  }
}

output "ecr_backend_repository_url" {
  description = "URL of the backend ECR repository (push prebuilt backend images here; EC2 pulls from it at boot)."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "URL of the frontend ECR repository (push prebuilt frontend images here; EC2 pulls from it at boot)."
  value       = aws_ecr_repository.frontend.repository_url
}
