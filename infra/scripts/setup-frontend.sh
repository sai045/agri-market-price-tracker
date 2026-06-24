#!/usr/bin/env bash
set -euo pipefail

: "${BUCKET_NAME:?Set BUCKET_NAME env var}"

aws s3api create-bucket --bucket "$BUCKET_NAME" || true
aws s3 website "s3://$BUCKET_NAME/" --index-document index.html --error-document index.html

cat <<EOF
Frontend bucket configured.
Next:
1) Upload dist files with aws s3 sync
2) Create CloudFront distribution pointing to this bucket
EOF
