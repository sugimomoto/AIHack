# シークレット本体の値は Terraform で管理しない。
# 値の投入は `gcloud secrets versions add` で行う（state に平文を残さない）

resource "google_secret_manager_secret" "orcarouter_key" {
  secret_id = "orcarouter-api-key"

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

resource "google_secret_manager_secret_iam_member" "run_access" {
  secret_id = google_secret_manager_secret.orcarouter_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.run.email}"
}
