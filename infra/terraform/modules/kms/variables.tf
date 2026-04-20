variable "name_prefix" {
  type        = string
  description = "Prefix for KMS key alias (e.g. hyperagent-prod-byok)"
}

variable "deletion_window_in_days" {
  type        = number
  description = "Schedule key deletion window"
  default     = 30
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
  default     = {}
}
