# state は GCS に置く（バージョニング有効）
terraform {
  backend "gcs" {
    bucket = "aida-505206-tfstate"
    prefix = "terraform/state"
  }
}
