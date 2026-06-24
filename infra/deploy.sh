#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENVIRONMENT="${1:-dev}"

echo "[1/5] Provisioning AWS infrastructure with Terraform..."
cd "$ROOT_DIR/infra/terraform"
terraform init
terraform apply -auto-approve -var="environment=$ENVIRONMENT"

echo "[2/5] Reading Terraform outputs..."
RDS_URL="$(terraform output -raw database_url)"
API_HOST="$(terraform output -raw api_host)"
BUCKET_NAME="$(terraform output -raw frontend_bucket)"
CLOUDFRONT_ID="$(terraform output -raw cloudfront_distribution_id)"

echo "[3/5] Running database migration on RDS..."
cd "$ROOT_DIR"
DATABASE_URL="$RDS_URL" npm run db:migrate --workspace server

echo "[4/5] Building and deploying frontend..."
npm run build --workspace client
aws s3 sync "$ROOT_DIR/client/dist" "s3://$BUCKET_NAME" --delete
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_ID" --paths "/*"

echo "[5/5] Deploying API build to EC2 host..."
npm run build --workspace server
tar -czf /tmp/server-dist.tar.gz -C "$ROOT_DIR/server" dist package.json package-lock.json
scp /tmp/server-dist.tar.gz "ec2-user@$API_HOST:/tmp/server-dist.tar.gz"
ssh "ec2-user@$API_HOST" "mkdir -p ~/app && tar -xzf /tmp/server-dist.tar.gz -C ~/app && cd ~/app && npm ci --omit=dev && pm2 restart market-price-tracker || pm2 start dist/index.js --name market-price-tracker"

echo "Deploy complete."
