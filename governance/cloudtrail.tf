# Organization-wide audit trail: every API call in every account (current and
# future), recorded centrally and tamper-resistantly.
#
# The trail and its bucket live in the MANAGEMENT account for now. The target
# architecture parks the bucket in a dedicated log-archive account; creating
# that account needs a unique corporate email alias, so it's a deliberate
# follow-up — moving the bucket later is a contained change.
#
# Management events only (the free tier of CloudTrail): who did what, from
# where, with which credentials. Data events (S3 object reads etc.) are
# paid and not needed at this scale.

data "aws_organizations_organization" "this" {
  provider = aws.mgmt
}

data "aws_caller_identity" "mgmt" {
  provider = aws.mgmt
}

resource "aws_s3_bucket" "cloudtrail" {
  provider = aws.mgmt

  bucket = "platta-cloudtrail-${data.aws_caller_identity.mgmt.account_id}"

  tags = {
    Name = "Platta-Org-CloudTrail-Logs"
  }
}

resource "aws_s3_bucket_versioning" "cloudtrail" {
  provider = aws.mgmt
  bucket   = aws_s3_bucket.cloudtrail.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail" {
  provider = aws.mgmt
  bucket   = aws_s3_bucket.cloudtrail.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "cloudtrail" {
  provider = aws.mgmt
  bucket   = aws_s3_bucket.cloudtrail.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Keep 400 days of audit history, then expire — enough for an annual review
# cycle with margin; revisit when a client compliance regime dictates more.
resource "aws_s3_bucket_lifecycle_configuration" "cloudtrail" {
  provider = aws.mgmt
  bucket   = aws_s3_bucket.cloudtrail.id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 400
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# CloudTrail's service must be allowed to write into the bucket.
resource "aws_s3_bucket_policy" "cloudtrail" {
  provider = aws.mgmt
  bucket   = aws_s3_bucket.cloudtrail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudTrailAclCheck"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.cloudtrail.arn
      },
      {
        Sid       = "CloudTrailWrite"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.cloudtrail.arn}/AWSLogs/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      }
    ]
  })
}

resource "aws_cloudtrail" "org" {
  provider = aws.mgmt

  name                          = "Platta-Org-Trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  is_organization_trail         = true
  is_multi_region_trail         = true
  include_global_service_events = true
  enable_log_file_validation    = true # tamper-evidence: signed digest files

  depends_on = [aws_s3_bucket_policy.cloudtrail]

  tags = {
    Name = "Platta-Org-Trail"
  }
}

output "cloudtrail_bucket" {
  description = "Central audit-log bucket (management account, pending log-archive account)."
  value       = aws_s3_bucket.cloudtrail.id
}

output "org_id" {
  description = "AWS Organization id."
  value       = data.aws_organizations_organization.this.id
}
