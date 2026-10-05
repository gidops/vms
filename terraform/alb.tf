# ---------------------------------------------------------------------------
# alb.tf — Application Load Balancer fronting the VMS app (HTTP-only interim).
#
#   Browser → http://<alb-dns>/       → ALB :80   → frontend target group :80
#   Browser → http://<alb-dns>:8080/  → ALB :8080 → backend  target group :4000
#
# There is no corporate domain yet, so no ACM cert and no HTTPS. The backend
# is exposed on a second listener port (8080) instead of a host-header rule,
# because host-based routing needs a real domain. When the domain decision
# lands: add ACM + a :443 listener with the api. host rule, restore the
# HTTP→HTTPS redirect, and drop the :8080 listener (git history has the
# previous HTTPS implementation to restore from).
# ---------------------------------------------------------------------------

# ---------------- ALB security group ----------------
# Public-facing. 443 is opened now so the HTTPS listener can be added later
# without an SG change; nothing listens on it yet.
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-ALB-SG"
  description = "Allow HTTP (80), backend API (8080) and future HTTPS (443) from the internet."
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "Frontend HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Backend API (interim, until a domain enables host routing)"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet (future listener)"
    from_port   = 443
    to_port     = 443
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
# Named -VMS-ALB: the hand-built Platta-NonProd-Dev-ALB still exists and ALB
# names are unique per region. The manual one is deleted at cleanup.
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

# ---------------- Listeners (HTTP interim) ----------------
resource "aws_lb_listener" "frontend_http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener" "backend_http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 8080
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ---------------- Outputs ----------------
output "alb_dns_name" {
  description = "The ALB's DNS name. Frontend: http://<this>/  Backend API: http://<this>:8080"
  value       = aws_lb.main.dns_name
}
