terraform {
  required_version = ">= 1.5.0"

  backend "s3" {                                                         
    bucket         = "vms-tfstate-102969867136"
    key            = "jenkins/terraform.tfstate"
    region         = "us-east-1"
    use_lockfile   = true          # ← new: S3-native locking
    encrypt        = true
  }

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
