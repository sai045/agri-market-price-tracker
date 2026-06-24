#!/usr/bin/env bash
set -euo pipefail

: "${DB_INSTANCE_IDENTIFIER:=market-price-tracker-db}"
: "${DB_USERNAME:=postgres}"
: "${DB_PASSWORD:?Set DB_PASSWORD env var}"

aws rds create-db-instance \
  --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --allocated-storage 20 \
  --master-username "$DB_USERNAME" \
  --master-user-password "$DB_PASSWORD" \
  --publicly-accessible \
  --backup-retention-period 7

echo "RDS creation requested: $DB_INSTANCE_IDENTIFIER"
