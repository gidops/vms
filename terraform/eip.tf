# Stable public IP for the backend, allocated in phase A.
#
# The frontend bakes NEXT_PUBLIC_API_BASE_URL into its client bundle at build
# time, so the backend's address must be known BEFORE the frontend image is
# built. Allocating the EIP up front makes that address deterministic and
# available at frontend-build time, independent of when the backend instance
# is created.
#
# This step ONLY allocates the address — it is intentionally NOT associated to
# any instance here (the backend instance doesn't exist yet). The
# aws_eip_association comes in a later main.tf edit.
#
# domain = "vpc" is the current syntax; the older `vpc = true` is deprecated.
resource "aws_eip" "backend" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-backend-eip"
  }
}

output "backend_eip" {
  description = "Stable public IP of the backend. Build the frontend image with NEXT_PUBLIC_API_BASE_URL=http://<this>:4000, and push backend image before applying instances."
  value       = aws_eip.backend.public_ip
}
