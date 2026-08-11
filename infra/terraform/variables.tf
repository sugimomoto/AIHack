variable "project_id" {
  type        = string
  description = "GCP プロジェクトID"
}

variable "region" {
  type        = string
  description = "デプロイ先リージョン。個人情報を扱うため国内に限定する"
  default     = "asia-northeast1"
}

variable "service_name" {
  type    = string
  default = "aida"
}

variable "image" {
  type        = string
  description = "デプロイするコンテナイメージ（Cloud Build が push したもの）"
}

variable "github_repo" {
  type        = string
  description = "GitHub リポジトリ（owner/repo）。Workload Identity 用"
  default     = "sugimomoto/AIHack"
}
