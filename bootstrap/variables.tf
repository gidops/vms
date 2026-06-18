variable "region" {
  description = "AWS region for the state bucket and lock table."
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket that will hold remote state. S3 bucket names are globally unique across ALL AWS accounts, so this must be a name no one else has taken. No default — pass it explicitly."
  type        = string
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking."
  type        = string
  default     = "vms-terraform-locks"
}
