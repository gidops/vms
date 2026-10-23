# The app host is private — there is deliberately no public_ip output anymore.
# Operator access is SSM: aws ssm start-session --target <instance-id>.

output "app_instance_id" {
  description = "Instance ID of the app host (for SSM Session Manager)."
  value       = aws_instance.app.id
}

output "rds_endpoint" {
  description = "Connection endpoint (host:port) of the RDS Postgres instance."
  value       = aws_db_instance.main.endpoint
}

output "backend_image_tag" {
  description = "Image tag (git SHA) currently deployed for the backend."
  value       = var.backend_image_tag
}

output "frontend_image_tag" {
  description = "Image tag (git SHA) currently deployed for the frontend."
  value       = var.frontend_image_tag
}
