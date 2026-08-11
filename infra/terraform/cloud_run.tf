# Cloud Run 本体
#
# ★最小インスタンス 0。個人負担のため常時稼働コストを持たない（K-02）

resource "google_service_account" "run" {
  account_id   = "${var.service_name}-run"
  display_name = "Aida Cloud Run runtime"
}

resource "google_cloud_run_v2_service" "app" {
  name                = var.service_name
  location            = var.region
  deletion_protection = false
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = 0 # ★常時稼働させない
      max_instance_count = 5
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      # ★APIキーは環境変数に直書きせず、Secret Manager から読む（AC-06）
      env {
        name = "ORCAROUTER_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.orcarouter_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 10
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# 一般公開（レビュアーがアクセスできる必要がある）
resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = google_cloud_run_v2_service.app.project
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
