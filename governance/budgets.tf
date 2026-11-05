# Cost guardrails. Soft budgets — alerts, no enforcement — per the approved
# billing-governance controls (plan §13.2). Thresholds at 50/80/100% of the
# cap, plus a forecast alert so overruns are flagged BEFORE they happen.

locals {
  thresholds = [50, 80, 100]
}

# Non-production account budget (tracks only this account's spend).
resource "aws_budgets_budget" "nonprod" {
  name         = "Platta-NonProd-Monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.nonprod_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = local.thresholds
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alert_email]
    }
  }

  # Forecast alert: fires when the month is PROJECTED to exceed the cap.
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}

# Organization-wide budget: lives in the management account, which sees
# consolidated spend across every member account.
resource "aws_budgets_budget" "org" {
  provider = aws.mgmt

  name         = "Platta-Org-Monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.org_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  dynamic "notification" {
    for_each = local.thresholds
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alert_email]
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
