output "jenkins_public_ip" {
  description = "Stable Elastic IP of the Jenkins server"
  value       = aws_eip.jenkins.public_ip
}

output "jenkins_url" {
  description = "Jenkins web UI"
  value       = "http://${aws_eip.jenkins.public_ip}:8080"
}

output "ssh_command" {
  description = "SSH into the Jenkins box"
  value       = "ssh -i ~/.ssh/vms-key.pem ubuntu@${aws_eip.jenkins.public_ip}"
}

output "initial_admin_note" {
  description = "How to fetch the first-run unlock password"
  value       = "Fetch the initial admin password with: sudo cat /var/lib/jenkins/secrets/initialAdminPassword (give the box a few minutes after apply for user_data to finish installing Jenkins)."
}
