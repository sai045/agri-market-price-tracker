variable "project_name" {
  type    = string
  default = "market-price-tracker"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "api_ami" {
  type        = string
  description = "Optional EC2 AMI override for API instance. Leave empty to use latest Amazon Linux 2023 AMI from SSM."
  default     = ""
}

variable "api_instance_type" {
  type        = string
  description = "EC2 instance type for API"
  default     = "t3.micro"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.micro"
}

variable "allowed_ssh_cidr" {
  type        = string
  description = "CIDR allowed for EC2 SSH access"
  default     = "0.0.0.0/0"
}

variable "ec2_key_name" {
  type        = string
  description = "Existing EC2 key pair name to attach to API instance"
  default     = ""
}
