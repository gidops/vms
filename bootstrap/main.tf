# ---------------- Remote state bucket ----------------
resource "aws_s3_bucket" "state" {
  bucket = var.state_bucket_name

  # This bucket holds ALL Terraform state for every other stack. Destroying it
  # would be catastrophic (you'd lose the record of every managed resource), so
  # block destroy outright.
  lifecycle {
    prevent_destroy = true
  }
}

# Versioning is CRITICAL: every state change becomes a recoverable version, so a
# corrupted or accidentally-overwritten state can be rolled back.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# SSE-S3 (AES256) encryption at rest. State files routinely contain secrets.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# State holds secrets — it must never be reachable publicly.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ---------------- State lock table ----------------
# PAY_PER_REQUEST so there's no idle cost — locking traffic is tiny and bursty.
resource "aws_dynamodb_table" "locks" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
