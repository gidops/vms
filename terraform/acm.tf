# ---------------------------------------------------------------------------
# acm.tf — TLS certificate for the VMS, validated via Route 53 DNS.
# Covers the frontend apex (aatcvms.online) and backend subdomain
# (api.aatcvms.online). The ALB HTTPS listener (alb.tf) attaches it.
#
# The hosted zone is a DATA SOURCE on purpose: it was created ONCE, outside
# this stack (zone Z07657652H1R7QE9UY8MM in the Platta non-prod account),
# because the registrar (Namecheap) holds the zone's nameserver addresses.
# If the zone lived in this stack, every destroy/rebuild would mint a new
# zone with NEW nameservers and silently orphan the registrar setting.
#
# PREREQUISITE for the first apply: the domain's nameservers at the registrar
# must already point at this zone, or the certificate's DNS validation below
# will hang until timeout.
# ---------------------------------------------------------------------------

data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_acm_certificate" "vms" {
  domain_name               = var.domain_name
  subject_alternative_names = ["api.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.name_prefix}-${var.env}-VMS-Cert"
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
