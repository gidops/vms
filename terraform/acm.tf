# ---------------------------------------------------------------------------
# acm.tf — TLS certificate for the VMS app, validated via Route 53 DNS.
# Covers the frontend apex (aatcvms.online) and backend subdomain
# (api.aatcvms.online). The ALB HTTPS listener (alb.tf, next phase) attaches it.
# ---------------------------------------------------------------------------

data "aws_route53_zone" "main" {
  name         = "aatcvms.online"
  private_zone = false
}

resource "aws_acm_certificate" "vms" {
  domain_name               = "aatcvms.online"
  subject_alternative_names = ["api.aatcvms.online"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-cert"
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.vms.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "vms" {
  certificate_arn         = aws_acm_certificate.vms.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

output "acm_certificate_arn" {
  description = "ARN of the validated ACM certificate (used by the ALB HTTPS listener)."
  value       = aws_acm_certificate_validation.vms.certificate_arn
}
