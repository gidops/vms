# Runtime secrets for the backend container.
#
# Generation stays in Terraform (random_*), but the values the instance needs
# at boot are DELIVERED via AWS Secrets Manager instead of being interpolated
# in plaintext into user_data (user_data is readable by anyone with
# ec2:DescribeInstanceAttribute). The instance role gets GetSecretValue on this
# one secret only (iam.tf); user_data fetches and parses it at boot.
#
# The generated values still exist in Terraform state — acceptable for dev
# because the state bucket is KMS-encrypted, versioned and access-restricted.

# JWT_SECRET — the backend requires a non-empty string (z.string().min(1)).
# 48 alphanumeric chars is ample entropy. special=false avoids shell-quoting
# hazards when this value is passed into `docker run -e`.
resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

# ENCRYPTION_KEY — the backend's encryption service requires a value that
# base64-decodes to EXACTLY 32 bytes (AES-256-GCM). random_bytes.length is a
# BYTE count, and its .base64 attribute yields the base64 string the app expects.
# Do NOT use random_password here — that would produce 32 base64 CHARACTERS
# (~24 bytes) and the backend would throw "ENCRYPTION_KEY must decode to 32
# bytes" at startup.
resource "random_bytes" "encryption_key" {
  length = 32
}

# DB master password. Alphanumeric-only to keep the value safe inside a
# postgres:// URL and inside a bash double-quoted string in user_data.
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  name        = "platta/nonprod/dev/vms"
  description = "VMS dev runtime secrets (JWT secret, encryption key, DB password) — fetched by the app host at boot."

  # Dev convenience: allow immediate delete/recreate while iterating. Raise to
  # a real recovery window (7–30 days) for staging/production secrets.
  recovery_window_in_days = 0

  tags = {
    Name = "${var.name_prefix}-${var.env}-VMS-Secret"
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    JWT_SECRET     = random_password.jwt_secret.result
    ENCRYPTION_KEY = random_bytes.encryption_key.base64
    DB_PASSWORD    = random_password.db.result
  })
}
