output "service_url" {
  value       = google_cloud_run_v2_service.app.uri
  description = "本番URL"
}

output "runtime_service_account" {
  value = google_service_account.run.email
}
