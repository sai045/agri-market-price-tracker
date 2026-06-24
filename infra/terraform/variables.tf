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
  description = "Ubuntu AMI for API EC2 instance"
  default     = "ami-0f58b397bc5c1f2e8"
}
