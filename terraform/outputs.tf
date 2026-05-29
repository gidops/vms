output "public_ip" {
  description = "Public IPv4 address of the frontend EC2 instance."
  value       = aws_instance.frontend.public_ip
}

output "backend_public_ip" {
  description = "Public IPv4 address of the backend EC2 instance."
  value       = aws_instance.backend.public_ip
}

output "rds_endpoint" {
  description = "Connection endpoint (host:port) of the RDS Postgres instance."
  value       = aws_db_instance.main.endpoint
}
