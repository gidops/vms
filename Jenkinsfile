// VMS — Jenkins CI + CD pipeline.
//
// Mirrors .github/workflows/ci.yml (which stays in place) and adds an optional
// CD stage that wraps ./vms-deploy.sh (build + push ECR images, terraform apply).
//
// Agent model:
//   - CI + Terraform-validate stages run inside throwaway Docker containers
//     (node:20.11.0 and hashicorp/terraform), so the Jenkins host only needs Docker.
//   - The Deploy stage builds Docker images and runs Terraform/AWS, so it runs on a
//     host agent labelled `vms-deploy` that has Docker, the AWS CLI v2 and Terraform
//     installed (building images inside a container is awkward; a tooled host is cleaner).
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
      description: 'Run the CD stage (build/push ECR images + terraform apply) after CI passes. Only honoured on main/staging.'
    )
    choice(
      name: 'DEPLOY_TARGET',
      choices: ['both', 'backend', 'frontend'],
      description: 'Which app(s) to deploy when DEPLOY is checked.'
    )
  }

  environment {
    AWS_REGION               = 'us-east-1'
    TURBO_TELEMETRY_DISABLED = '1'
    NPM_CONFIG_FUND          = 'false'
    NPM_CONFIG_AUDIT         = 'false'
  }

  stages {
    // ---------------- CI gate (node:20.11.0 container) ----------------
    stage('CI') {
      agent {
        docker {
          image 'node:20.11.0'
          // Run as root so npm can write into the workspace-mounted node_modules.
          args  '-u root:root'
        }
      }
      stages {
        stage('Install')   { steps { sh 'npm ci' } }                         // postinstall runs `prisma generate`
        stage('Lint')      { steps { sh 'npx turbo run lint:check' } }
        stage('Typecheck') { steps { sh 'npx turbo run typecheck' } }
        stage('Build')     { steps { sh 'npx turbo run build' } }
        stage('Storybook') { steps { sh 'npx turbo run build-storybook' } }
        stage('Test')      { steps { sh 'npx turbo run test' } }
      }
    }

    // ---------------- Terraform validate (hashicorp/terraform container) ----------------
    stage('Terraform validate') {
      agent {
        docker {
          image 'hashicorp/terraform:1.9'
          // The image's entrypoint is `terraform`; clear it so `sh` can run.
          args  '--entrypoint='
        }
      }
      steps {
        dir('terraform') {
          sh 'terraform fmt -check'
          sh 'terraform init -backend=false'
          sh 'terraform validate'
        }
      }
    }

    // ---------------- CD (host agent with docker + aws + terraform) ----------------
    stage('Deploy') {
      when {
        allOf {
          expression { return params.DEPLOY }
          anyOf { branch 'main'; branch 'staging' }
        }
      }
      agent { label 'vms-deploy' }
      environment {
        // Skip the interactive `read` prompt in vms-deploy.sh; the human gate is the
        // `input` step below, which shows the proposed target before anything applies.
        VMS_AUTO_APPROVE = '1'
      }
      steps {
        // Manual approval — last chance to read what is about to be deployed.
        // NOTE: terraform here uses LOCAL state (terraform/terraform.tfstate). For
        // Jenkins-driven deploys to be safe/repeatable, migrate to a remote backend
        // (S3 + DynamoDB lock) first — see the notes at the bottom of this file.
        input message: "Deploy '${params.DEPLOY_TARGET}' from ${env.BRANCH_NAME} @ ${env.GIT_COMMIT?.take(8)}?",
              ok: 'Deploy'

        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-vms'   // Jenkins "AWS Credentials" entry
        ]]) {
          sh './vms-deploy.sh --deploy ${DEPLOY_TARGET}'
        }
      }
    }
  }

  post {
    success { echo 'Pipeline succeeded.' }
    failure { echo 'Pipeline failed.' }
  }
}

// ──────────────────────────── Jenkins setup ────────────────────────────
// One-time configuration needed for this pipeline:
//
// Plugins:  Docker Pipeline, Pipeline: AWS Steps (or AWS Credentials), Git.
//
// CI / validate stages:  any agent with Docker available (the controller or a
//   build node where the `jenkins` user is in the `docker` group).
//
// Deploy agent:  a node labelled `vms-deploy` with Docker, AWS CLI v2 and
//   Terraform >= 1.9 installed, and the Docker daemon reachable.
//
// Credentials:  add an "AWS Credentials" item with ID `aws-vms` (an IAM user/role
//   that can push to ECR + run the Terraform-managed resources). The
//   AmazonWebServicesCredentialsBinding above exports AWS_ACCESS_KEY_ID /
//   AWS_SECRET_ACCESS_KEY for the duration of the deploy.
//
// Terraform state ⚠:  vms-deploy.sh runs `terraform output`/`apply` against state
//   in ./terraform. Today that state is LOCAL (no backend block) and lives on the
//   developer's machine — a fresh Jenkins workspace has none, so a deploy would try
//   to recreate the whole stack. Before enabling CD, move state to a remote backend
//   (S3 bucket + DynamoDB lock table) so Jenkins and humans share one source of truth.
//
// Pipeline job:  create a Multibranch Pipeline (or Pipeline-from-SCM) pointing at
//   this repo; the Jenkinsfile path is the repo root.
