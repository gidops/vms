variable "region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type = string
  # Jenkins + docker image builds need RAM; t2.micro is too small (OOMs on the
  # Next.js/turbo image build, same reason the app stack uses prebuilt ECR images).
  default = "t3.large"
}

variable "key_name" {
  type = string
  # Reuse the existing EC2 key pair (the app stack assumes it already exists too).
  default = "vms-key"
}

variable "allowed_ip" {
  type        = string
  description = "Supply via: export TF_VAR_allowed_ip=\"$(curl -s https://checkip.amazonaws.com)/32\". No default — must be set explicitly so a stale IP is never baked in."
}

variable "project_name" {
  type    = string
  default = "vms-jenkins"
}
