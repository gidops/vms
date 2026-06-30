# ---------------------------------------------------------------------------
# alb.tf — Application Load Balancer fronting the VMS app with HTTPS.
#
#   Browser → https://aatcvms.online       → ALB :443 → frontend target group :80
#   Browser → https://api.aatcvms.online    → ALB :443 → backend  target group :4000
#
# The ALB terminates TLS using the ACM cert from acm.tf. Traffic from the ALB to
# the instances stays HTTP on the private VPC network (that hop never leaves AWS).
# Serving the browser over HTTPS gives the secure context the app needs for
# cookies / auth to work correctly.
# ---------------------------------------------------------------------------

# ---------------- ALB security group ----------------
# Public-facing: accepts HTTPS (443) and HTTP (80, for the redirect) from anywhere.
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Allow HTTP/HTTPS inbound to the ALB from the internet."
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
    Name = "${var.project_name}-alb-sg"
  }
}

# ---------------- The load balancer ----------------
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public.id, aws_subnet.public_b.id]

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# ---------------- Target groups ----------------
# Frontend: the instance serves the Next.js app on port 80 (docker -p 80:3000).
resource "aws_lb_target_group" "frontend" {
  name     = "${var.project_name}-frontend-tg"
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
    Name = "${var.project_name}-frontend-tg"
  }
}

# Backend: the API serves on port 4000, with a /health endpoint.
resource "aws_lb_target_group" "backend" {
  name     = "${var.project_name}-backend-tg"
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
    Name = "${var.project_name}-backend-tg"
  }
}

# ---------------- Register the instances in the target groups ----------------
resource "aws_lb_target_group_attachment" "frontend" {
  target_group_arn = aws_lb_target_group.frontend.arn
  target_id        = aws_instance.frontend.id
  port             = 80
}

resource "aws_lb_target_group_attachment" "backend" {
  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.backend.id
  port             = 4000
}

# ---------------- Listeners ----------------
# HTTPS :443 — terminates TLS with the ACM cert. Default action routes to the
# frontend; a host-based rule sends api.aatcvms.online to the backend.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.vms.certificate_arn

  # Default: frontend (apex aatcvms.online).
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Route api.aatcvms.online to the backend target group.
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    host_header {
      values = ["api.aatcvms.online"]
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
  name    = "aatcvms.online"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "backend" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.aatcvms.online"
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
