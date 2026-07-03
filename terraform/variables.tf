variable "region" {
  description = "AWS region to deploy resources into."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for the frontend server."
  type        = string
  default     = "t2.micro"
}

variable "project_name" {
  description = "Project name; used as a prefix for resource Name tags."
  type        = string
  default     = "vms"
}

variable "key_name" {
  description = "Name of an existing EC2 key pair to attach to the instance for SSH access."
  type        = string
  default     = "vms-key"
}

variable "backend_image_tag" {
  description = "Image tag (git SHA) for the backend image."
  type        = string
}

# -----------------------------------------------------------------------------
# Email transport (backend). Mirrors the backend env schema
# (apps/backend/src/shared/config/env.schema.ts): EMAIL_PROVIDER selects the
# implementation, and the backend treats empty strings as unset — falling back
# to its log provider — so leaving credentials blank never breaks boot.
# Real values live in a gitignored terraform.tfvars (see terraform.tfvars.example).
# -----------------------------------------------------------------------------

variable "app_public_url" {
  description = "Public URL of the frontend (APP_PUBLIC_URL); used to build rating/feedback links in emails."
  type        = string
  default     = "https://aatcvms.online"
}

variable "email_enabled" {
  description = "Whether the backend sends real emails (EMAIL_ENABLED)."
  type        = bool
  default     = true
}

variable "email_provider" {
  description = "Active email transport (EMAIL_PROVIDER): smtp | gmail | mailtrap | sendgrid."
  type        = string
  default     = "mailtrap"

  validation {
    condition     = contains(["smtp", "gmail", "mailtrap", "sendgrid"], var.email_provider)
    error_message = "email_provider must be one of: smtp, gmail, mailtrap, sendgrid."
  }
}

variable "email_from" {
  description = "From address for outbound email (EMAIL_FROM)."
  type        = string
  default     = ""
}

variable "mailtrap_host" {
  description = "Mailtrap live SMTP host (MAILTRAP_HOST)."
  type        = string
  default     = "live.smtp.mailtrap.io"
}

variable "mailtrap_port" {
  description = "Mailtrap live SMTP port (MAILTRAP_PORT)."
  type        = number
  default     = 2525
}

variable "mailtrap_user" {
  description = "Mailtrap SMTP username (MAILTRAP_USER)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "mailtrap_pass" {
  description = "Mailtrap SMTP password (MAILTRAP_PASS)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "whatsapp_enabled" {
  description = "Enable the WhatsApp notification channel"
  type        = bool
  default     = false
}


variable "whatsapp_provider" {
  description = "WhatsApp provider backend (twilio or meta)"
  type        = string
  default     = "twilio"

  validation {
    condition     = contains(["twilio", "meta"], var.whatsapp_provider)
    error_message = "whatsapp_provider must be one of: twilio, meta."
  }
}

variable "whatsapp_use_templates" {
  description = "Use approved HSM templates instead of free-text messages (false for Twilio sandbox)"
  type        = bool
  default     = false
}


variable "twilio_account_sid" {
  description = "Twilio account SID (shared by SMS and WhatsApp providers)"
  type        = string
  sensitive   = true
}

variable "twilio_auth_token" {
  description = "Twilio auth token for API authentication"
  type        = string
  sensitive   = true
}

variable "twilio_whatsapp_from" {
  description = "WhatsApp sender number (Twilio sandbox or approved number)"
  type        = string
}

variable "sendgrid_api_key" {
  description = "SendGrid HTTP API key (SENDGRID_API_KEY, the SG.* value)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "frontend_image_tag" {
  description = "Image tag (git SHA) for the frontend image."
  type        = string
}
