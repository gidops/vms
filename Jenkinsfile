// VMS — Jenkins CD pipeline (deploy only).
//
// CI (install/lint/typecheck/build/test + SonarCloud + terraform validate) now
// runs in GitHub Actions (.github/workflows/ci.yml). The CI stages below are
// COMMENTED OUT (not deleted) so Jenkins CI can be restored by uncommenting if
// ever needed as a fallback.
//
// This pipeline is CD only: a manual, approval-gated deploy that wraps
// ./vms-deploy.sh (build + push ECR images, terraform apply). It runs on a host
// agent labelled `vms-deploy` whose EC2 instance profile (role vms-jenkins-role)
// provides AWS credentials — nothing is stored in Jenkins.

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
    // ---- CI stages disabled: CI now runs in GitHub Actions (.github/workflows/ci.yml). ----
    // ---- Left commented (not deleted) so Jenkins CI can be restored by uncommenting. ----
    /*
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
        stage('Install') {
          steps {
            // Capture the branch into a GLOBAL env var while the SCM checkout is in
            // scope here, so the Deploy gate (beforeAgent true) can read it later —
            // at that point Deploy's own agent/checkout hasn't run, so GIT_BRANCH
            // isn't yet populated there. Strip any "origin/" prefix to a bare name.
            script {
              env.DEPLOY_BRANCH = (env.GIT_BRANCH ?: env.BRANCH_NAME ?: '').replaceAll('^origin/', '')
            }
            sh 'npm ci'   // postinstall runs `prisma generate`
          }
        }
        stage('Lint')      { steps { sh 'npx turbo run lint:check' } }
        stage('Typecheck') { steps { sh 'npx turbo run typecheck' } }
        stage('Build')     { steps { sh 'npx turbo run build' } }
        stage('Storybook') { steps { sh 'npx turbo run build-storybook' } }
        stage('Test')      { steps { sh 'npx turbo run test' } }
      }
    }

    // ---------------- SonarCloud analysis (sonar-scanner-cli container) ----------------
    // Runs on every CI build (not gated behind the Deploy params). Scan only for
    // now — no quality-gate stage yet.
    stage('SonarCloud analysis') {
      agent {
        docker {
          image 'sonarsource/sonar-scanner-cli:latest'
          args  '--entrypoint='
        }
      }
      environment {
        SONAR_TOKEN    = credentials('sonarcloud-token')
        SONAR_HOST_URL = 'https://sonarcloud.io'
        // The container runs as the jenkins UID, which can't write the scanner's
        // default cache at /opt/sonar-scanner/.sonar (root-owned in the image).
        // Point SONAR_USER_HOME at the workspace (jenkins-owned, writable).
        SONAR_USER_HOME = "${WORKSPACE}/.sonar"
      }
      steps {
        sh 'sonar-scanner'
      }
    }

    // ---------------- Terraform validate (hashicorp/terraform container) ----------------
    stage('Terraform validate') {
      agent {
        docker {
          // Pin to the same Terraform the deploy box runs (1.15.6). A 1.9 container
          // can't decode the 1.15.6-written backend cache ("unsupported attribute
          // use_lockfile"), and they share the Jenkins workspace.
          image 'hashicorp/terraform:1.15.6'
          // The image's entrypoint is `terraform`; clear it so `sh` can run.
          args  '--entrypoint='
        }
      }
      steps {
        dir('terraform') {
          sh 'terraform fmt -check'
          // Drop any .terraform left by the host deploy (shared workspace) so this
          // validate is self-contained — it's only a local cache, and the
          // -backend=false init below recreates what validate needs.
          sh 'rm -rf .terraform'
          sh 'terraform init -backend=false'
          sh 'terraform validate'
        }
      }
    }
    */

    // ---------------- CD (host agent with docker + aws + terraform) ----------------
    stage('Deploy') {
      when {
        beforeAgent true
        allOf {
          expression { return params.DEPLOY }
          // env.BRANCH_NAME is provided by the Multibranch job and is available
          // without the (now-commented-out) CI stage that used to set DEPLOY_BRANCH.
          expression { return ['main', 'staging'].contains(env.BRANCH_NAME) }
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
        // NOTE: state is in S3 (see provider.tf backend blocks); the vms-deploy
        // agent's instance profile provides AWS access.
        input message: "Deploy '${params.DEPLOY_TARGET}' from ${env.BRANCH_NAME} @ ${env.GIT_COMMIT?.take(8)}?",
              ok: 'Deploy'

        // No withCredentials binding: the vms-deploy agent runs on an EC2 host
        // whose instance profile (role vms-jenkins-role) grants AWS access, so
        // the AWS CLI / Terraform inherit credentials automatically.
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
// One-time configuration needed for this pipeline:
//
// Plugins:  Git. (Docker Pipeline is no longer required by the active stages —
//   the docker-agent CI stages are commented out — but it's harmless if it stays
//   installed, and is needed again if those CI stages are ever restored. No AWS
//   plugin needed: the deploy shells out to the raw aws CLI + terraform on the
//   agent, which use the instance-profile creds.)
//
// Deploy agent:  a node labelled `vms-deploy` with Docker, AWS CLI v2 and
//   Terraform >= 1.9 installed, and the Docker daemon reachable.
//
// Credentials:  none stored in Jenkins. The vms-deploy agent runs on an EC2 host
//   whose instance profile (role vms-jenkins-role) grants AWS access, so the AWS
//   CLI / Terraform inherit credentials automatically — no aws-vms entry or
//   AmazonWebServicesCredentialsBinding is needed.
//
// Terraform state:  vms-deploy.sh runs `terraform output`/`apply` against state
//   in ./terraform, which is now stored remotely in S3 with a DynamoDB lock table
//   (see the backend "s3" blocks in terraform/provider.tf and jenkins/provider.tf).
//   Jenkins and humans share one source of truth, so a fresh Jenkins workspace
//   reads existing state instead of trying to recreate the stack.
//
// Pipeline job:  a Multibranch Pipeline is REQUIRED (not plain Pipeline-from-SCM):
//   the Deploy gate reads env.BRANCH_NAME, which only a Multibranch job populates.
//   Point it at this repo; the Jenkinsfile path is the repo root.
