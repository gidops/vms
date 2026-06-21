output "state_bucket" {
  description = "Name of the S3 bucket holding remote state."
  value       = aws_s3_bucket.state.id
}

output "lock_table" {
  description = "Name of the DynamoDB state-lock table."
  value       = aws_dynamodb_table.locks.name
}

output "backend_config_hint" {
  description = "Drop this backend block into each stack, changing only `key`."
  value       = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${aws_s3_bucket.state.id}"
        key            = "<STACK_NAME>/terraform.tfstate"  # e.g. "jenkins/terraform.tfstate"
        region         = "${var.region}"
        dynamodb_table = "${aws_dynamodb_table.locks.name}"
        encrypt        = true
      }
    }
  EOT
}
