# Agricultural Market Price Tracker

Full-stack web app for daily agricultural market tracking with:
- Admin-only data entry (max price only)
- Public dashboards (today, history, seasons, holidays)
- Flat item master (no category/variety split)
- Telugu names stored in DB (`name_te`)
- Per-city holidays including recurring weekly and annual rules

## Tech Stack

- Frontend: React + TypeScript + Vite + Recharts
- Backend: Node.js + Express + TypeScript + PostgreSQL
- Infra: AWS (RDS + EC2 + S3 + CloudFront), Terraform, GitHub Actions

## Project Structure

```text
market-price-tracker/
├── client/
├── server/
├── db/migrations/
├── infra/
│   ├── deploy.sh
│   ├── scripts/
│   └── terraform/
├── docker-compose.yml
└── README.md
```

## Local Setup

1. Install dependencies

```bash
cd client && npm install
cd ../server && npm install
```

2. Start PostgreSQL

```bash
docker-compose up -d
```

3. Configure backend env

```bash
cp server/.env.example server/.env
```

4. Run DB migration

```bash
cd server
npm run db:migrate
```

5. Start backend

```bash
cd server
npm run dev
```

6. Configure frontend env

```bash
cp client/.env.example client/.env
```

7. Start frontend

```bash
cd client
npm run dev
```

## Admin Bootstrap

First run auto-creates admin from backend env:
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`

Default dev values in `.env.example`:
- Email: `admin@example.com`
- Password: `ChangeMe123!`

## API Summary

Public:
- `GET /api/cities`
- `GET /api/items`
- `GET /api/prices/latest?cityId=...`
- `GET /api/prices?cityId=...&itemId=...`
- `GET /api/prices/trends?cityId=...&itemId=...&days=90`
- `GET /api/seasons`
- `GET /api/holidays?cityId=...&year=2026`

Admin:
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/admin/me`
- `GET /api/admin/masters`
- `POST /api/admin/cities`
- `POST /api/admin/units`
- `POST /api/admin/items`
- `POST /api/admin/seasons`
- `POST /api/admin/holidays`
- `POST /api/admin/prices`
- `POST /api/admin/prices/bulk`

## AWS Deployment Scripts

### Manual script-based deployment

```bash
bash infra/deploy.sh dev
```

The script:
1. Runs Terraform apply
2. Reads infra outputs
3. Runs server migration against RDS
4. Builds/syncs frontend to S3 + CloudFront invalidation
5. Builds/deploys API bundle to EC2

### Free-tier guardrails and IAM (CLI)

1. Create budget + billing alarms (recommended first):

```bash
ALERT_EMAIL=you@example.com bash infra/scripts/setup-cost-guardrails.sh
```

2. Create GitHub OIDC deploy role for this repo:

```bash
bash infra/scripts/setup-github-oidc-role.sh sai045 agri-market-price-tracker
```

This prints the role ARN to store as GitHub secret `AWS_DEPLOY_ROLE_ARN`.

### Terraform-only quick start

```bash
cd infra/terraform
terraform init
terraform apply -var="db_password=<your-password>"
```

## GitHub Actions

Workflow file: `.github/workflows/deploy.yml`

Required secrets:
- `AWS_DEPLOY_ROLE_ARN`
- `DB_PASSWORD`
- `JWT_SECRET`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `EC2_SSH_PRIVATE_KEY` (required for API deployment step)
- `EC2_KEY_NAME` (EC2 key pair name attached to API instance)
- `TF_STATE_BUCKET` (remote Terraform state S3 bucket)
- `TF_STATE_KEY` (e.g. `prod/terraform.tfstate`)
- `TF_LOCK_TABLE` (DynamoDB lock table for Terraform)

Recommended:
- Keep `aws_region` as `us-east-1` for billing metrics + simplest setup.
- Use `t3.micro` for EC2 and `db.t3.micro` for RDS (already defaulted).

## Notes for Data Entry

- No seed script for business data.
- Add cities/items/units/seasons/holidays via admin UI.
- Holidays are always city-specific.
- Sunday off can be configured as recurring weekly with `day_of_week = 0`.
