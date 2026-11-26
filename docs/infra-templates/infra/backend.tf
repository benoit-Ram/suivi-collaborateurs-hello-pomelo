# State Terraform stocké dans un bucket DO Spaces (compatible S3 API).
# Un workspace Terraform par environnement (preprod | prod).
# Credentials d'accès au bucket : dans Infisical /bootstrap, injectées via
# env vars AWS_* au moment du `terraform init`.

terraform {
  backend "s3" {
    bucket                      = "hp-tf-state-suivi-collaborateurs"
    key                         = "env.tfstate" # suffixé par workspace
    region                      = "us-east-1"   # bidon, DO ignore mais S3 l'exige
    endpoints = {
      s3 = "https://fra1.digitaloceanspaces.com"
    }
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = false
    use_lockfile                = true # verrou natif S3 (évite les applies concurrents)
    # Clés d'accès via AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY exportées par la CI
  }
}
