# ---------------------------------------------------------------------------
# Governance stack — org-level and account-level guardrails for Platta
# Integrated AWS. Deliberately SEPARATE from the app stack (terraform/):
# guardrails must survive app environment teardowns, and they span two
# accounts. State lives under its own key in the corporate state bucket.
#
# Two providers:
#   aws        → Platta_Non_Production (account-level guardrails)
#   aws.mgmt   → the management account (org trail, org-wide budget)
# ---------------------------------------------------------------------------

terraform {
  required_version = "~> 1.15"

  backend "s3" {
    bucket       = "platta-tfstate-912759111217"
    key          = "governance/terraform.tfstate"
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
  }
}

provider "aws" {
  region  = var.region
  profile = var.nonprod_profile
}

provider "aws" {
  alias   = "mgmt"
  region  = var.region
  profile = var.mgmt_profile
}
