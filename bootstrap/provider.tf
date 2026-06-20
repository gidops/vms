# Bootstrap stack — creates the S3 bucket + DynamoDB lock table that hold the
# remote state for the other stacks (terraform/ and jenkins/). This stack itself
# uses LOCAL state: it is the accepted end of the bootstrap recursion (you can't
# store the state backend's own definition in the backend it creates).
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}
