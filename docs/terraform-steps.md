# VMS — Deployment Runbook

How to deploy the AATC Visitor Management System (VMS) to AWS. The app runs as
**prebuilt Docker images pulled from ECR** — EC2 does not build from source.

---

## Before you run Terraform

Have these ready on the machine you deploy from (not on AWS):

1. **Terraform** installed.
2. **Docker** running, with enough RAM to build the images locally (a `t2.micro`
   cannot build the Next.js image — that is why images are built locally and pushed).
3. **AWS CLI** configured with credentials that can manage VPC/EC2/RDS/ECR/IAM.
   Verify: `aws sts get-caller-identity`.
4. **EC2 key pair** named `vms-key` existing in the target region (`us-east-1`),
   with the private key at `~/.ssh/vms-key.pem`.
5. The repo checked out, on the working branch, and you are in its **root**
   (the directory that contains `terraform/`).

Why a key pair and region matter: the instances reference `vms-key` for SSH, and all
resources are created in `us-east-1` by default (change via `terraform/variables.tf`).

---

## Running it

**Which command do I run?**

- **Nothing is deployed yet** (first time, or you previously ran `terraform destroy`) → use **`--fresh`**. This builds and creates everything from scratch. This is the one to start with.
- The stack is already up and you changed code → `--update`.
- The stack is up but an instance is broken → `--redeploy`.

If unsure whether anything exists, check: `terraform -chdir=terraform output backend_eip`.
An error or empty result means nothing is deployed → use `--fresh`.

The deploy is **phased**, because the frontend bakes the backend's address into its
JavaScript at build time — so the backend address must exist before the frontend is built.
`--fresh` handles all phases for you.

Place `vms-deploy.sh` at the repo root and run:

```bash
chmod +x vms-deploy.sh
./vms-deploy.sh --fresh        # nothing deployed yet — full deploy from scratch
```

`--fresh` runs: create ECR repos + Elastic IP → build & push both images (frontend with
the EIP baked in) → create the full stack (VPC, RDS, 2× EC2, IAM). RDS takes 5–10 minutes.

All modes:

| Command                                                | Use when                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `./vms-deploy.sh --fresh`                              | **No instances exist yet** (first deploy, or after `destroy`). Creates everything from scratch. |
| `./vms-deploy.sh --update [backend\|frontend\|both]`   | Instances exist; you changed code and want it live.                                             |
| `./vms-deploy.sh --redeploy [backend\|frontend\|both]` | Instances exist but one is broken; recreate it, no rebuild.                                     |

The script pauses to show the Terraform plan before applying. **Confirm the plan replaces only
the instance(s) you intend** — it must not show `aws_eip.backend` or `aws_db_instance.main`.

> Manual equivalent, if not using the script:
>
> ```bash
> # Phase A
> terraform -chdir=terraform apply -target=aws_ecr_repository.backend \
>   -target=aws_ecr_repository.frontend -target=aws_eip.backend
> terraform -chdir=terraform output            # note backend_eip + repo URLs
> # Phase B — login, then build/push backend, then frontend with --build-arg
> #   NEXT_PUBLIC_API_BASE_URL=http://<backend_eip>:4000
> # Phase C
> terraform -chdir=terraform apply
> ```

---

## After it runs

### Verify (wait 2–3 min after apply — instances finish booting after Terraform reports done)

```bash
ssh -i ~/.ssh/vms-key.pem ubuntu@<backend_eip>     # backend_eip from `terraform output`
sudo docker ps                                      # vms-backend should be "Up"
sudo docker logs vms-backend                        # migrations applied, Nest started
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/health   # expect 200
```

Frontend: browse to `terraform -chdir=terraform output public_ip`. (Some local networks
intercept bare-IP HTTP; if the page looks wrong, try another network/device.)

### Tear down (RDS + 2× EC2 bill by the minute — destroy when done)

```bash
terraform -chdir=terraform destroy
```

This releases the Elastic IP, so the next deploy gets a new backend address (and the
frontend is rebuilt against it).
