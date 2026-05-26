output "public_ip" {
  description = "Public IPv4 address of the frontend EC2 instance."
  value       = aws_instance.frontend.public_ip
}
