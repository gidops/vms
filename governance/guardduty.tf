# Threat detection. Standalone detectors in both accounts for now — simple,
# immediately effective, and free for the first 30 days then ~dollars/month
# at this scale. Upgrading to organization-managed GuardDuty (management
# account as delegated admin, auto-enrol of future accounts) is a follow-up
# once the log-archive account exists.

resource "aws_guardduty_detector" "nonprod" {
  enable = true

  # Scan every 15 min instead of hourly costs nothing extra at this scale.
  finding_publishing_frequency = "FIFTEEN_MINUTES"
}

resource "aws_guardduty_detector" "mgmt" {
  provider = aws.mgmt

  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"
}
