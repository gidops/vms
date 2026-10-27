# AATC Visitor Management System (VMS)

The VMS keeps track of every visitor to the Afreximbank African Trade Centre
(AATC) in Abuja. Staff invite guests, the Security Manager approves them,
reception checks them in with a badge, and every step is recorded. It works in
English, French and Arabic.

This page explains how to run the system on a computer that is already set up
for it. Copy each command exactly as shown.

- Want to know how to **use** the system? Read the [User guide](./docs/user-guide.md).
- Are you a **developer**? Start with the [Developer guide](./docs/development.md).

---

## Before you start

1. Open **Docker Desktop** and wait until it says it is running.
2. Open a terminal in the project folder (the folder that contains this file).

## First time only

Run these once, in order. Each one can take a few minutes.

1. Install the project's libraries:
   ```bash
   npm install
   ```
2. Prepare the project:
   ```bash
   npm run build
   ```
3. Create the settings files (this never overwrites existing ones):
   ```bash
   cp -n apps/backend/.env.example apps/backend/.env
   cp -n apps/frontend/.env.example apps/frontend/.env
   ```

## Start the system

Do this every time you want to use the system.

1. Start the database:
   ```bash
   npm run db:start
   ```
2. Bring the database up to date:
   ```bash
   npm run db:migrate
   ```
   It says `No pending migrations to apply` when there is nothing to do. That is fine.
3. Start the server. Leave this terminal open:
   ```bash
   npm run backend
   ```
   Wait until you see `Nest application successfully started`.
4. Open a **second** terminal in the same folder and start the website. Leave
   this one open too:
   ```bash
   npm run frontend
   ```
   Wait until you see `Ready`.
5. Open <http://localhost:3000> in your browser.

**The very first time**, there are no accounts yet. Open
<http://localhost:3000/signup> and create the first account. It becomes the
System Admin, who then creates everyone else's accounts under **Users**.

## Stop the system

1. In each of the two terminals, press **Ctrl + C**.
2. Stop the database:
   ```bash
   docker compose stop
   ```

Your data is kept. Next time, follow [Start the system](#start-the-system) again.

## After getting a new version of the code

Run these three commands, then [start the system](#start-the-system) as usual:

```bash
npm install
npm run build
npm run db:migrate
```

## Useful addresses

| What                             | Address                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The system                       | <http://localhost:3000>                                                                                       |
| French / Arabic                  | <http://localhost:3000/fr>, <http://localhost:3000/ar>                                                        |
| Server check (should say `"ok"`) | <http://localhost:4000/health>                                                                                |
| Database browser (Adminer)       | <http://localhost:8080> (system **PostgreSQL**, server **postgres**, user, password and database all **vms**) |
| Activity log viewer (Seq)        | <http://localhost:8081>                                                                                       |

## If something goes wrong

| What you see                                                         | What to do                                                                                                        |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon` or `docker: command not found` | Docker Desktop is not running. Open it, wait, and try again.                                                      |
| `npm run db:migrate` fails with "Can't reach database server"        | Run `npm run db:start` first, wait 10 seconds, then try again.                                                    |
| `port is already in use` / `EADDRINUSE`                              | The system is already running in another terminal. Close that terminal (or press Ctrl + C in it) and start again. |
| The browser shows "This site can't be reached"                       | Check that both terminals are still open and showed `Nest application successfully started` and `Ready`.          |
| Signing in fails on a brand new setup                                | No account exists yet. Create one at <http://localhost:3000/signup>.                                              |
| Every page shows "404"                                               | Stop the website (Ctrl + C), run `rm -rf apps/frontend/.next`, then `npm run frontend` again.                     |
| Anything else                                                        | Copy the last lines from the terminal and send them to the development team.                                      |

## Documentation

| For                       | Document                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Everyone using the system | [User guide](./docs/user-guide.md)                                                                                          |
| Managers and operators    | [How the system runs, explained simply](./docs/infrastructure.md) · [Running in Docker and deploying](./docs/operations.md) |
| Developers                | [Developer guide](./docs/development.md) · [all technical docs](./docs/README.md)                                           |
