# ---------------------------------------------------------------------------
# alb.tf — Application Load Balancer fronting the VMS over HTTPS.
#
#   Browser → https://aatcvms.online      → ALB :443 → frontend target group :80
#   Browser → https://api.aatcvms.online  → ALB :443 → backend  target group :4000
#   (http:// on either host → 301 redirect to https://)
#
# TLS terminates at the ALB with the ACM cert from acm.tf; the hop from ALB
# to the instance stays HTTP on the private VPC network. Route 53 ALIAS
# records point both hostnames at the ALB, and because they are Terraform-
# managed they re-point automatically whenever the stack is rebuilt — the
# registrar/nameserver setup is never touched again.
# ---------------------------------------------------------------------------

# ---------------- ALB security group ----------------
resource "aws_security_group" "alb" {
  name = "${var.name_prefix}-ALB-SG"
  # NOTE: SG descriptions are IMMUTABLE in AWS — changing this string forces a
  # whole-group replacement, which deadlocks on a fixed-name SG attached to a
  # live ALB (can't delete old: in use; can't create new first: name taken).
  # The text is stale (8080 is gone) and must stay until a from-scratch build.
  description = "Allow HTTP (80), backend API (8080) and future HTTPS (443) from the internet."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet (redirected to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-ALB-SG"
  }
}

# ---------------- The load balancer ----------------
resource "aws_lb" "main" {
  name               = "${var.name_prefix}-${var.env}-VMS-ALB"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = {
    Name = "${var.name_prefix}-${var.env}-VMS-ALB"
  }
}

# ---------------- Target groups ----------------
# Both point at the SAME single app host, on different ports.

# Frontend: the host serves the Next.js app on port 80 (docker -p 80:3000).
resource "aws_lb_target_group" "frontend" {
  name     = "${var.name_prefix}-${var.env}-VMS-FE-TG"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.name_prefix}-${var.env}-VMS-FE-TG"
  }
}

# Backend: the API serves on port 4000, with a DB-aware /health endpoint.
resource "aws_lb_target_group" "backend" {
  name     = "${var.name_prefix}-${var.env}-VMS-BE-TG"
  port     = 4000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.name_prefix}-${var.env}-VMS-BE-TG"
  }
}

# ---------------- Register the single host in both target groups ----------------
resource "aws_lb_target_group_attachment" "frontend" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.app.id
  port             = 80
}

resource "aws_lb_target_group_attachment" "backend" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.app.id
  port             = 4000
}

# ---------------- Listeners ----------------
# HTTPS :443 — terminates TLS with the ACM cert. Default action routes to the
# frontend; a host-based rule sends api.<domain> to the backend.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.vms.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = ["api.${var.domain_name}"]
    }
  }
}

# HTTP :80 — redirect everything to HTTPS.
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ---------------- DNS: point the domains at the ALB ----------------
resource "aws_route53_record" "frontend" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "backend" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# ---------------- Outputs ----------------
output "alb_dns_name" {
  description = "The ALB's DNS name (the domains alias to this)."
  value       = aws_lb.main.dns_name
}

output "api_base_url" {
  description = "Browser-facing API base URL baked into the frontend bundle."
  value       = "https://api.${var.domain_name}"
}

output "app_url" {
  description = "Browser-facing frontend URL."
  value       = "https://${var.domain_name}"
}
