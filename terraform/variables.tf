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

variable "frontend_image_tag" {
  description = "Image tag (git SHA) for the frontend image."
  type        = string
}
