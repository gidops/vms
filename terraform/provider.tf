terraform {
  required_version = "~> 1.15"

  # State lives in the Platta Integrated non-production account, NOT the old
  # individual account. The bucket is versioned + KMS-encrypted and was created
  # outside Terraform (bootstrap chicken-and-egg). One key per environment:
  # nonprod/dev, nonprod/staging (future), etc.
  backend "s3" {
    bucket       = "platta-tfstate-912759111217"
    key          = "nonprod/dev/terraform.tfstate"
    region       = "us-east-1"
    profile      = "platta-nonprod"
    use_lockfile = true
    encrypt      = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.region
  # Identity Center SSO profile for the Platta non-prod account. Run
  # `aws sso login --profile platta-nonprod` when the session expires.
  profile = var.aws_profile
}
