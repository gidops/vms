variable "region" {
  description = "Primary region for governance resources."
  type        = string
  default     = "us-east-1"
}

variable "nonprod_profile" {
  description = "SSO profile for the Platta_Non_Production account."
  type        = string
  default     = "platta-nonprod"
}

variable "mgmt_profile" {
  description = "SSO profile for the organization management account."
  type        = string
  default     = "platta-mgmt"
}

variable "alert_email" {
  description = "Recipient for budget and security alert notifications."
  type        = string
  default     = "gideon.ebubechukwu@pentagonsecurities.net"
}

variable "nonprod_budget_usd" {
  description = "Monthly cost budget for the non-production account (alerts at 50/80/100%)."
  type        = number
  default     = 100
}

variable "org_budget_usd" {
  description = "Monthly cost budget for the whole organization, tracked in the management account."
  type        = number
  default     = 300
}
