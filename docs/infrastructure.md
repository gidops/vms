# Infrastructure, explained simply

**Who this is for:** anyone who needs to understand how the VMS runs, on a
laptop and on AWS, without being an infrastructure expert. **What you'll
learn:** the moving parts, how they talk to each other, where settings and
secrets live, and the risks to know about. Step-by-step commands are in
[operations.md](./operations.md).

## 1. The 30-second picture

There are three moving parts: the **frontend**, the **backend** and the
**database**. Everything else is plumbing.

```
   YOUR BROWSER
       │  1. loads the web page
       ▼
  ┌─────────────┐   2. the browser then calls the API directly   ┌─────────────┐
  │  FRONTEND   │ · · · · · · · · · · · · · · · · · · · · · · ▶ │   BACKEND   │
  │  (Next.js)  │                                               │  (NestJS)   │
  └─────────────┘                                               └──────┬──────┘
                                                                       │ 3. reads/writes data
                                                                       ▼
                                                                ┌─────────────┐
                                                                │  DATABASE   │
                                                                │ (Postgres)  │
                                                                └─────────────┘
```

1. Your browser asks the **frontend** for the web page and gets HTML and
   JavaScript back.
2. Once the page is running, **your browser** (not the frontend server) calls the
   **backend** API directly.
3. Only the **backend** touches the **database**.

## 2. Containers

- A **Docker image** is a ready-to-run package of an app and everything it needs.
- A **container** is one running copy of an image.
- A **Dockerfile** is the recipe that builds the image.

Both apps use **multi-stage Dockerfiles** (`apps/backend/Dockerfile`,
`apps/frontend/Dockerfile`): a large build stage compiles the code, then only
the compiled output is copied into a small final image.

Locally, **Docker Compose** runs the containers. On AWS, the server runs them
with `docker run`.

## 3. Local setup

`docker-compose.yml` describes the local containers:

| Container  | Open it at     | Port (host → container) | What it is                             |
| ---------- | -------------- | ----------------------- | -------------------------------------- |
| `frontend` | localhost:3000 | 3000 → 3000             | The Next.js web app                    |
| `backend`  | localhost:4000 | 4000 → 4000             | The NestJS API                         |
| `postgres` | localhost:5432 | 5432 → 5432             | The database                           |
| `adminer`  | localhost:8080 | 8080 → 8080             | Web UI to browse the database          |
| `seq`      | localhost:8081 | 8081 → 80 (ingest 5341) | Web UI to search logs and audit events |

Three more services (`sonar-db-init`, `sonarqube`, `sonar-scanner`) only start
with the `sonar` profile; see [ci-quality.md](./ci-quality.md).

The usual dev setup runs only `postgres`, `adminer` and `seq` in Docker and runs
the two apps directly on your machine for fast reloads.

### How containers find each other

Compose puts all containers on one private network where each container is
reachable by its **service name**. Inside that network the backend reaches the
database at host `postgres` and Seq at `http://seq:5341`.

### The `localhost` vs `postgres` gotcha

The backend finds the database through `DATABASE_URL`:

- Backend running **on your laptop** (`npm run start:dev`): host is
  **`localhost`** → `postgresql://vms:vms@localhost:5432/vms`
- Backend running **inside Compose**: host is **`postgres`** →
  `postgresql://vms:vms@postgres:5432/vms`

If the backend reports "database disconnected", check this first.

## 4. How the pieces talk

### Frontend → backend

The browser calls the backend using `NEXT_PUBLIC_API_BASE_URL`
(`apps/frontend/data/http/client.ts`). Locally that is `http://localhost:4000`.
There is no proxy in between.

**Important:** variables starting with `NEXT_PUBLIC_` are **baked into the
JavaScript when the frontend image is built**. Changing them on a running
container does nothing; the image must be rebuilt. This is why the deploy script
builds the frontend with the API address and checks that it was baked in.

### Backend → database

The backend uses **Prisma** (a database library) with `DATABASE_URL`. It listens
on `PORT` (default 4000).

CORS (which websites may call the API from a browser) currently allows any
origin (`app.enableCors(...)` in `apps/backend/src/main.ts`).

### Migrations run automatically in containers

A **migration** is a script that changes the database structure. When the
backend container starts, `apps/backend/docker-entrypoint.sh`:

1. waits until the database is reachable,
2. runs `prisma migrate deploy`,
3. starts the app.

When running the backend on your laptop you run `npx prisma migrate deploy`
yourself.

## 5. Environment variables

Environment variables carry settings and secrets into the apps.

- Locally each app reads a `.env` file (`apps/backend/.env`,
  `apps/frontend/.env`). These are **not** in Git. Create them by copying the
  committed `.env.example` files.
- The backend checks its settings at start-up
  (`apps/backend/src/shared/config/env.schema.ts`) and **refuses to start** if a
  required one is missing or wrong, naming the variable.

**Backend** (main ones; the full list is in `apps/backend/.env.example`):

| Variable                                          | Required?                 | Purpose                                                                  |
| ------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                                    | yes                       | How to reach Postgres                                                    |
| `JWT_SECRET`                                      | yes                       | Signs login tokens                                                       |
| `ENCRYPTION_KEY`                                  | optional (derived in dev) | Encrypts personal data (AES-256)                                         |
| `PORT`, `NODE_ENV`, `JWT_EXPIRES_IN`, `LOG_LEVEL` | optional                  | Defaults provided                                                        |
| `TRUST_PROXY_HOPS`                                | optional                  | Number of proxies in front of the API (`1` behind the AWS load balancer) |
| `SEED_DEMO_DATA`                                  | optional (off)            | Creates demo visits on boot                                              |
| `APP_PUBLIC_URL`                                  | optional                  | Public frontend URL used in email links                                  |
| Email / SMS / WhatsApp, `S3_BUCKET`, `SEQ_URL`    | optional                  | Messaging, uploads, log mirror; off when unset                           |

**Frontend** (`NEXT_PUBLIC_`, so public and fixed at build time; never put a
secret here): `NEXT_PUBLIC_API_BASE_URL` (backend address) and
`NEXT_PUBLIC_APP_URL` (the app's own URL).

## 6. Local vs AWS

| Concept            | Local (Docker Compose)     | AWS (Terraform, `terraform/`)                                                                           |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frontend + backend | Two containers             | **One EC2 server** (`aws_instance.app`, t3.small, Amazon Linux 2023) runs both containers               |
| Entry point        | `localhost:3000` / `:4000` | An **HTTPS load balancer**: `https://aatcvms.online` → frontend, `https://api.aatcvms.online` → backend |
| Network            | Compose network            | A VPC with public subnets (load balancer, NAT), private app subnets, private database subnets           |
| Database           | `postgres` container       | **RDS** PostgreSQL 16 (`db.t3.micro`), private, reachable only from the app server                      |
| Images             | Built by Compose           | Built on the deploying machine, pushed to **ECR**, pulled by the server at boot                         |
| Secrets            | `.env` files               | Generated by Terraform, stored in **Secrets Manager**, read by the server at boot                       |
| Operator access    | Your terminal              | **SSM Session Manager** (no SSH port open)                                                              |
| Seq, Adminer       | Containers                 | Not deployed; audit stays in the `AuditLog` table                                                       |

Traffic path in AWS:

```
Browser ─HTTPS─▶ Load balancer (TLS certificate from ACM)
                   ├─ aatcvms.online      ─▶ app server :80   ─▶ frontend container :3000
                   └─ api.aatcvms.online  ─▶ app server :4000 ─▶ backend container
                                                                   │
                                                                   ▼
                                                             RDS PostgreSQL
```

The server sits in a private subnet with no public IP. It reaches the internet
(to pull images and read secrets) through a NAT gateway. Its firewall only
accepts traffic from the load balancer; the database only accepts traffic from
the server.

## 7. How production secrets flow

1. Terraform generates `JWT_SECRET`, `ENCRYPTION_KEY` and the database password
   (`terraform/secrets.tf`) and stores them in one **Secrets Manager** secret.
2. The server's boot script (`user_data` in `terraform/main.tf`) reads that
   secret, then starts the backend container with `docker run -e …`.
3. Email and WhatsApp settings come from Terraform variables
   (`terraform/terraform.tfvars`, copied from `terraform.tfvars.example`, not in
   Git).

The generated values also exist in the **Terraform state** (see glossary), so
access to the state bucket must stay restricted.

## 8. Deploying, in one picture

```
build images ──▶ push to ECR ──▶ terraform apply ──▶ new server boots, pulls images, runs them
 (vms-deploy.sh)                  (replaces the server when an image tag changes)
```

Each image is tagged with the Git commit it was built from. Changing either tag
replaces the single server, so both containers restart (short downtime). The
database is not touched.

Deploys are run with `./vms-deploy.sh` from a workstation or from Jenkins.
Commands are in [operations.md](./operations.md); the CI checks that must pass
first are in [ci-quality.md](./ci-quality.md).

## 9. Other AWS stacks in the repo

Each folder below is a separate Terraform project with its own state.

| Folder        | What it creates                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `terraform/`  | The app environment described above.                                                                                                 |
| `bootstrap/`  | An encrypted, versioned S3 bucket for Terraform state, plus a DynamoDB lock table. Applied once.                                     |
| `governance/` | Account guardrails: an organisation-wide CloudTrail audit trail, GuardDuty threat detection, and cost budgets with alerts.           |
| `jenkins/`    | The Jenkins server: an EC2 instance in the default VPC, a fixed IP, a firewall limited to one IP, and an IAM role allowed to deploy. |

## 10. Risks to know about

1. **The frontend's API address is fixed at build time.** If the domain
   changes, rebuild the frontend (`./vms-deploy.sh --deploy frontend` or
   `both`). The deploy script refuses to continue if the address was not baked
   in.
2. **Dev database has no final snapshot.** `skip_final_snapshot = true` on RDS:
   destroying or replacing the database deletes its data. The code comments say
   staging/production should get snapshots, deletion protection and Multi-AZ.
3. **Secrets are in Terraform state.** Keep the state bucket locked down.
4. **CORS is open.** Any website can call the API from a browser (tokens are
   still required).
5. **One server.** A deploy restarts both apps; a server failure takes the app
   down until `--redeploy` replaces it.
6. **First login.** No admin is seeded. Right after the first deploy, open
   `/signup` and create the System Admin; the screen then locks.
7. **Rate limits are in memory.** Self-registration limits are counted per
   backend process. With more than one backend, they need a shared store.

## 11. Glossary

- **VPC**: your own private network inside AWS.
- **Subnet**: a slice of the VPC. Public subnets reach the internet directly;
  private ones do not.
- **NAT gateway**: lets servers in private subnets make outbound internet calls
  without being reachable from the internet.
- **Security group**: a firewall around a resource: which ports, from where.
- **Load balancer (ALB)**: receives HTTPS traffic and forwards it to the server,
  choosing frontend or backend by host name.
- **ACM**: AWS Certificate Manager, issues the HTTPS certificate.
- **Route 53**: AWS DNS; maps `aatcvms.online` and `api.aatcvms.online` to the
  load balancer.
- **EC2**: a virtual server.
- **ECR**: AWS's private registry for Docker images.
- **RDS**: AWS's managed database service.
- **Secrets Manager**: AWS storage for secrets, readable only by allowed roles.
- **SSM Session Manager**: browser/CLI shell access to a server without SSH.
- **IAM role**: a set of AWS permissions given to a server or person.
- **user_data**: a script AWS runs the first time a server boots.
- **Terraform**: describes infrastructure as code so it can be recreated.
- **Terraform state**: Terraform's record of what it created. Stored in S3,
  locked during changes so two people cannot apply at once.
