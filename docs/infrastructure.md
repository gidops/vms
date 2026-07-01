# Infrastructure, explained simply

A plain-language guide to how the VMS actually *runs* — the containers, the
database, how they talk to each other, and where environment variables live —
both on your laptop and on AWS.

If you want exact commands, see [`runbook.md`](./runbook.md) (local) and
[`terraform-steps.md`](./terraform-steps.md) (AWS). This doc is the **mental
model** behind those.

---

## 1. The 30-second mental model

There are really only three moving parts: the **frontend**, the **backend**, and
the **database**. Everything else is plumbing.

```
   YOUR BROWSER
       │
       │  1. loads the web page
       ▼
  ┌─────────────┐        2. browser then calls the API directly      ┌─────────────┐
  │  FRONTEND   │ · · · · · · · · · · · · · · · · · · · · · · · · · ▶ │   BACKEND   │
  │  (Next.js)  │                                                    │  (NestJS)   │
  └─────────────┘                                                    └──────┬──────┘
                                                                            │ 3. reads/writes data
                                                                            ▼
                                                                     ┌─────────────┐
                                                                     │  DATABASE   │
                                                                     │ (Postgres)  │
                                                                     └─────────────┘
```

1. Your browser asks the **frontend** for the web page. The frontend hands back
   HTML + JavaScript.
2. **This is the part that surprises people:** once the page is running, *your
   browser* — not the frontend server — calls the **backend** API directly. The
   frontend server's job is basically done after it serves the page.
3. The **backend** is the only thing that touches the **database**. The browser
   and database never speak to each other.

Keep that picture in your head; the rest of this doc just fills in details.

---

## 2. What a "container" is here

- A **Docker image** is a frozen, ready-to-run snapshot of an app + everything it
  needs (Node, the compiled code, etc.). Think "a `.zip` that knows how to run
  itself."
- A **container** is one running copy of an image. Same image → start as many
  identical containers as you like.
- A **Dockerfile** is the recipe that builds the image.

Both our apps use **multi-stage Dockerfiles** (`apps/backend/Dockerfile`,
`apps/frontend/Dockerfile`): a big "builder" stage compiles everything, then only
the final compiled output is copied into a tiny "runner" image. That's why the
shipped images are small even though building them needs a lot of tooling.

You don't run images by hand. Locally, **Docker Compose** runs them; on AWS, each
server runs one with `docker run`.

---

## 3. Local setup, piece by piece

Locally everything is described in one file: **`docker-compose.yml`**. One command
(`docker compose up`) starts these five containers:

| Container  | Open it at        | Port (host → inside) | What it is                          |
| ---------- | ----------------- | -------------------- | ----------------------------------- |
| `frontend` | localhost:3000    | 3000 → 3000          | The Next.js web app                 |
| `backend`  | localhost:4000    | 4000 → 4000          | The NestJS API                      |
| `postgres` | localhost:5432    | 5432 → 5432          | The database                        |
| `adminer`  | localhost:8080    | 8080 → 8080          | A web UI to browse the database     |
| `seq`      | localhost:8081    | 8081 → 80            | A web UI to search logs/audit trail |

> `host:inside` means the port on your machine maps to a (sometimes different)
> port inside the container. E.g. Seq's UI is port 80 *inside* the container but
> you reach it at `localhost:8081`.

### How do the containers find each other?

When Compose starts, it puts all five containers on one private virtual network.
On that network, **each container can reach another by its service name as if it
were a hostname.** So inside the network:

- the backend reaches the database at the hostname **`postgres`** (not `localhost`),
- the backend ships logs to Seq at **`http://seq:5341`**,
- Adminer connects to the DB using server name **`postgres`**.

### The one gotcha that bites everyone: `localhost` vs `postgres`

The backend finds the database via a setting called `DATABASE_URL`. The host part
of that URL changes depending on *where the backend is running*:

- Backend running **on your laptop** (the normal dev flow, `npm run start:dev`) →
  the DB is at **`localhost`** → `postgresql://vms:vms@localhost:5432/vms`
- Backend running **inside Compose** (`docker compose up`) → the DB is at
  **`postgres`** (the service name) → `postgresql://vms:vms@postgres:5432/vms`

If you ever see the backend fail with "database disconnected," this host value is
the first thing to check.

---

## 4. How the pieces talk

### Frontend → backend (the important one)

The frontend container does **not** call the backend container. Instead:

1. The browser loads the page from the frontend.
2. The JavaScript now running **in the browser** calls the backend directly using
   a base URL stored in `NEXT_PUBLIC_API_BASE_URL`
   (see `apps/frontend/data/http/client.ts`). Locally that's `http://localhost:4000`.

There is no proxy or rewrite in between — it's a plain cross-origin `fetch` from
the browser to the API.

**Why you must care:** because the *browser* makes the call, the backend has to be
reachable from wherever the user's browser is. On your laptop that's `localhost`.
On AWS that has to be a real, public address (more on this below).

### 🔑 The single most important fact for deployment

`NEXT_PUBLIC_*` variables are **baked into the JavaScript at build time**, not read
when the app runs. When the frontend image is built, whatever
`NEXT_PUBLIC_API_BASE_URL` was set to gets *hard-coded into the bundle*. You cannot
change it later by setting an environment variable on the running container — you'd
have to rebuild the image.

Remember this; section 9 explains the trap it creates in production.

### Backend → database

The backend talks to Postgres through **Prisma** (an ORM). The connection string
is `DATABASE_URL` (`apps/backend/prisma/schema.prisma`). The backend listens on the
port in `PORT` (default `4000`, see `apps/backend/src/main.ts`).

CORS (which browsers are allowed to call the API) is currently wide open —
`app.enableCors()` with no restrictions. Fine for getting started; worth tightening
later.

### Database migrations run automatically

When the backend **container** starts, its entrypoint script
(`apps/backend/docker-entrypoint.sh`) does three things in order:

1. waits until the database is reachable,
2. runs `prisma migrate deploy` (applies any new DB schema changes),
3. starts the app (`node dist/main.js`).

So you never run migrations by hand in containers/prod — booting the backend does
it. (On your laptop in dev mode you run `npx prisma migrate deploy` yourself once.)

---

## 5. Environment variables (where settings & secrets live)

Environment variables are how we feed settings (DB URL, secret keys, feature flags)
into the apps without hard-coding them.

- **Locally**, each app reads a `.env` file next to it:
  `apps/backend/.env` and `apps/frontend/.env`. Compose loads these into the
  containers via `env_file`.
- `.env` is **gitignored** (it can hold secrets). A committed **`.env.example`**
  lists every key with blank/example values, so you know what to fill in.
- The backend **validates its env on startup** with a strict schema
  (`apps/backend/src/shared/config/env.schema.ts`). If a required variable is
  missing or malformed, the backend **refuses to start** and tells you which one.
  This is a feature — it fails loudly instead of misbehaving.

**Backend** — only two are strictly required; the rest have sane defaults:

| Variable       | Required? | What it's for                                |
| -------------- | --------- | -------------------------------------------- |
| `DATABASE_URL` | ✅ yes    | How to reach Postgres                        |
| `JWT_SECRET`   | ✅ yes    | Signs login tokens                           |
| `ENCRYPTION_KEY` | optional (derived in dev) | Encrypts sensitive fields (AES-256) |
| `PORT`, `NODE_ENV`, `JWT_EXPIRES_IN`, `LOG_LEVEL` | optional | Defaults provided |
| SMTP / Twilio / SendGrid / S3 / Seq keys | optional | Email, SMS, uploads, log mirror — off by default |

Sensitive ones to guard: `JWT_SECRET`, `ENCRYPTION_KEY`, and any Twilio/SMTP/
SendGrid keys.

**Frontend** — both are `NEXT_PUBLIC_` (so, baked in at build time **and** visible
to anyone in the browser — never put a secret here):

| Variable                  | What it's for                          |
| ------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`| Address of the backend API             |
| `NEXT_PUBLIC_APP_URL`     | The app's own public URL (for links)   |
| `NEXT_PUBLIC_S3_BASE_URL` | Optional — base URL for avatar images  |

> Rule of thumb: `NEXT_PUBLIC_` = public + frozen at build. Everything without that
> prefix (all backend vars) = server-only + read at runtime.

---

## 6. Local vs Prod — what actually changes

The *shape* is identical (frontend, backend, database). Only the **plumbing around
them** changes. Here's the translation table:

| Concept                     | Local (Docker Compose)                  | AWS Production (Terraform)                                  |
| --------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Frontend                    | `frontend` container                    | A small **EC2 server** running the frontend image (`-p 80:3000`) |
| Backend                     | `backend` container                     | A separate **EC2 server** running the backend image (`-p 4000:4000`) |
| Database                    | `postgres` container                    | **AWS RDS** managed Postgres 16 (private, not on the public internet) |
| How they find each other    | Service names on a Compose network      | Fixed IP addresses + **security groups** (firewall rules)  |
| Where the images come from  | Built on your machine by Compose        | Built once, pushed to **ECR** (AWS's image registry), servers pull them |
| How env vars get in         | `.env` files                            | `docker run -e ...`, with secrets generated by Terraform   |
| Frontend's backend URL      | `localhost:4000` from `.env`            | The backend's **Elastic IP**, baked in at build time       |
| Log/audit viewer (Seq)      | `seq` container                         | **Not deployed** — audit still recorded in the DB `AuditLog` table |
| DB admin UI (Adminer)       | `adminer` container                     | **Not deployed** — connect with a DB client over SSH if needed |

Two things worth calling out:

- **No ECS/Fargate, no load balancer.** Production is deliberately simple: plain
  EC2 virtual machines each running one `docker run`. Traffic hits the servers'
  IP addresses directly. (Why not build images on the server? A tiny `t2.micro`
  can't build the Next.js image — it runs out of memory. So we build elsewhere and
  the server just *pulls and runs*.)
- **The database is private.** RDS is not reachable from the internet. Its firewall
  only allows the backend server to connect on port 5432. Good default.

---

## 7. How production env vars & secrets actually flow

This answers "where do I store env variables in prod?" — and the answer is a bit
unusual, so read carefully.

**Backend secrets are generated by Terraform and injected at server boot.** In
`terraform/secrets.tf`, Terraform creates random values:

- `JWT_SECRET` (random 48 chars),
- `ENCRYPTION_KEY` (random 32 bytes, base64),
- the database password (random 32 chars).

When the backend server boots, its startup script (`user_data` in
`terraform/main.tf`) runs roughly:

```bash
docker run -d --name vms-backend -p 4000:4000 \
  -e DATABASE_URL="postgres://vmsuser:<generated-pw>@<rds-address>:5432/vmsdb" \
  -e JWT_SECRET="<generated>" \
  -e ENCRYPTION_KEY="<generated>" \
  <ecr-repo>/vms-backend:<git-sha>
```

So there is **no `.env` file in production** and **no AWS Secrets Manager** — the
values are passed straight into the container as `-e` flags. They are stored in the
**Terraform state file**, which lives in an encrypted S3 bucket
(`terraform/provider.tf`) with a DynamoDB lock. (Note: an older note in
`runbook.md` says state is "local" — that's outdated; the `bootstrap/` folder sets
up the S3 remote state.)

**The frontend's backend URL is handled completely differently** — it's baked in
when the image is *built*, not when the server runs. The deploy script builds the
frontend like this:

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE_URL="http://<backend-elastic-ip>:4000" ...
```

That's why the backend gets a stable **Elastic IP** (`terraform/eip.tf`): the
frontend needs a fixed backend address to hard-code into its JavaScript.

---

## 8. Deploying: the big picture

You don't run `terraform apply` directly — there's a wrapper script,
`vms-deploy.sh`, that does the steps in the right order. The flow is:

```
  build image  ──▶  push to ECR  ──▶  terraform apply  ──▶  EC2 boots & pulls image & runs it
   (locally)        (AWS registry)     (creates/updates servers)
```

Because the frontend has to bake in the backend's address, the **first** deploy is
*phased*: create the backend's Elastic IP first, then build the frontend against
that IP, then bring everything up. The script handles this for you.

Real commands (the script's actual modes):

```bash
./vms-deploy.sh --deploy both          # first deploy / build + push + apply both apps
./vms-deploy.sh --deploy backend       # ship only a new backend; leave frontend as-is
./vms-deploy.sh --redeploy frontend    # recreate a broken server, no rebuild
```

> ⚠️ `docs/terraform-steps.md` currently mentions `--fresh` / `--update` flags —
> those don't exist in the script. The real flags are `--deploy` and `--redeploy`
> as above. Run `./vms-deploy.sh` with no arguments to see the built-in usage.

CI/CD: every push is checked by **GitHub Actions** and **Jenkins** (lint,
typecheck, build, test, `terraform validate`). Only Jenkins can *deploy*, only from
`main`/`staging`, and only behind a manual approval gate.

---

## 9. What to watch out for on production (checklist)

The Terraform was written but **never run yet**, so treat the first deploy as a
test. Here are the real traps, roughly in priority order:

1. **🪤 The #1 trap — the frontend's backend address is frozen at build time.**
   If the backend's Elastic IP ever changes (most commonly: you run
   `terraform destroy` and redeploy — the IP is released and you get a new one),
   the *old* frontend image still points at the dead address and the app silently
   can't reach the API. **Fix:** after any backend-IP change, rebuild and repush the
   frontend (`./vms-deploy.sh --deploy both`). The deploy script has a safety check
   that fails the build if the right IP isn't baked in.

2. **No HTTPS, no domain name.** Everything is bare-IP over plain HTTP
   (`http://<ip>` for the frontend, `http://<ip>:4000` for the API). Login tokens
   travel unencrypted, browsers may warn, and some networks block bare-IP HTTP. For
   anything beyond a demo you'll want a domain + TLS certificate (Route53 + ACM, and
   likely a load balancer) — none of that exists yet. Also, CORS is wide open.

3. **Secrets live in Terraform state.** They're in the encrypted S3 state bucket,
   but anyone who can read that bucket can read the DB password, JWT secret, and
   encryption key. Lock down access to the state bucket; consider moving secrets to
   AWS Secrets Manager / SSM Parameter Store later.

4. **The database has no backups and is easy to delete.** RDS is set with
   `skip_final_snapshot = true` and no backup retention — `terraform destroy` (or
   replacing the RDS resource) **permanently deletes all data with no snapshot.**
   Turn on automated backups / a final snapshot before storing anything real.

5. **The firewall is too open.** SSH (port 22) and the backend API (port 4000) are
   currently reachable from anywhere (`0.0.0.0/0`). Restrict SSH to your IP, and
   ideally don't expose the raw backend port to the whole internet.

6. **How you log in the first time.** No admin account is seeded. The first person
   to use the **`/signup`** screen becomes `SUPER_ADMIN`
   (`apps/backend/src/shared/auth/seeder.service.ts`). So right after deploy, go to
   `/signup` and create your admin — *then* you'd normally close signup.
   ⚠️ Also: the "only seed demo data outside production" guard is currently
   **commented out**, so demo visit/alert rows will be created in production too.
   Re-enable that guard (`seeder.service.ts` ~lines 94–96) before a real launch if
   you don't want fake data in prod.

7. **Some settings aren't wired for prod.** These exist in `.env.example` but
   Terraform doesn't set them, so features stay off until you add them to the
   backend's `docker run -e ...` (or the frontend build args):
   `NEXT_PUBLIC_APP_URL`, email/SMS (SMTP/Twilio/SendGrid), S3 uploads, and
   `SEQ_URL` (no Seq server in prod — audit logging still works via the database).

8. **Prerequisites before the first `apply`:**
   - An EC2 key pair named **`vms-key`** must already exist in **`us-east-1`** (for SSH).
   - AWS credentials configured (`aws sts get-caller-identity` should work).
   - Docker running locally (to build the images).
   - The **`bootstrap/`** stack applied first (it creates the S3 state bucket + lock table).

---

## 10. Mini glossary

- **VPC** — your own private network inside AWS. Everything lives in it.
- **Subnet** — a slice of that network. "Public" subnets can reach the internet.
- **Security group** — a firewall around a server: which ports, from which sources.
- **Elastic IP (EIP)** — a public IP address that stays the same even if the server
  is recreated. We use one so the backend has a stable address.
- **EC2** — a virtual machine (a plain server you rent by the hour).
- **ECS / Fargate** — AWS's "run containers for me" services. We **don't** use them;
  we run containers on plain EC2 with `docker run`.
- **ECR** — AWS's private Docker image registry. We push images here; servers pull them.
- **RDS** — AWS's managed database service. We use it for Postgres so we don't run
  the DB ourselves.
- **user_data** — a startup script AWS runs the first time a server boots. Ours
  installs Docker and launches the container.
- **Terraform** — describes all the AWS infrastructure as code, so it's repeatable.
- **Terraform state** — Terraform's record of what it has created. Ours is stored in
  an S3 bucket; it contains the generated secrets, so keep it protected.

---

*See also: [`runbook.md`](./runbook.md) for local commands,
[`terraform-steps.md`](./terraform-steps.md) for the deploy walkthrough, and
[`architecture.md`](./architecture.md) for how the application code is organized.*
