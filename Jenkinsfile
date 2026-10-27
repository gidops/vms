// VMS — Jenkins deployment pipeline.
//
// Quality checks (lint, typecheck, tests, Sonar, terraform validate) run in
// GitHub Actions (.github/workflows/ci.yml). Jenkins only deploys: it wraps
// ./vms-deploy.sh (build + push ECR images, terraform apply), and refuses to run
// unless GitHub Actions passed on the exact commit being deployed.
//
// Prerequisites on the Jenkins host — see the "Jenkins setup" notes at the bottom.

pipeline {
  agent none

  options {
    timestamps()
    disableConcurrentBuilds()
    timeout(time: 60, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  parameters {
    booleanParam(
      name: 'DEPLOY',
      defaultValue: false,
      description: 'Build/push ECR images + terraform apply. Only honoured on main/staging, and only when GitHub Actions passed on the commit.'
    )
    choice(
      name: 'DEPLOY_TARGET',
      choices: ['both', 'backend', 'frontend'],
      description: 'Which app(s) to deploy when DEPLOY is checked.'
    )
  }

  environment {
    AWS_REGION = 'us-east-1'
  }

  stages {
    stage('Deploy') {
      when {
        beforeAgent true
        expression { return params.DEPLOY }
      }
      agent { label 'vms-deploy' }
      environment {
        // Skip the interactive `read` prompt in vms-deploy.sh; the human gate is the
        // `input` step below, which shows the proposed target before anything applies.
        VMS_AUTO_APPROVE = '1'
        GITHUB_TOKEN     = credentials('github-checks-token')
      }
      steps {
        script {
          def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replaceAll('^origin/', '')
          if (!['main', 'staging'].contains(branch)) {
            error "Deploys only run from main or staging (this build is '${branch}')."
          }
        }

        sh './scripts/require-github-checks.sh "$GIT_COMMIT"'

        input message: "Deploy '${params.DEPLOY_TARGET}' from ${env.BRANCH_NAME} @ ${env.GIT_COMMIT?.take(8)}?",
              ok: 'Deploy'

        // AWS access comes from the agent's EC2 instance profile (vms-jenkins-role).
        sh './vms-deploy.sh --deploy ${DEPLOY_TARGET}'
      }
    }
  }

  post {
    success { echo 'Pipeline succeeded.' }
    failure { echo 'Pipeline failed.' }
  }
}

// ──────────────────────────── Jenkins setup ────────────────────────────
// Plugins:  Git, Credentials Binding. (No AWS plugin — the deploy shells out to
//   the aws CLI + terraform on the agent, which use the instance-profile creds.)
//
// Deploy agent:  a node labelled `vms-deploy` with Docker, AWS CLI v2,
//   Terraform >= 1.9, curl and python3 installed, and the Docker daemon reachable.
//
// Credentials:
//   - `github-checks-token` (Secret text): a fine-grained GitHub token with
//     read-only "Checks" access to gidops/vms, used to confirm CI passed.
//   - AWS: none stored — the agent's instance profile grants access.
//
// Terraform state:  stored in S3 with a DynamoDB lock table (backend "s3" blocks
//   in terraform/provider.tf), so Jenkins and humans share one source of truth.
//
// Pipeline job:  a Multibranch Pipeline (or Pipeline-from-SCM) pointing at this
//   repo; the Jenkinsfile path is the repo root.
