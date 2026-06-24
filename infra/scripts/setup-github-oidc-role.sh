#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash infra/scripts/setup-github-oidc-role.sh sai045 agri-market-price-tracker
# Output:
#   Prints role ARN to use in GitHub secret AWS_DEPLOY_ROLE_ARN

OWNER="${1:?GitHub owner required}"
REPO="${2:?GitHub repo required}"
ROLE_NAME="${ROLE_NAME:-GitHubActionsDeployRole}"
POLICY_NAME="${POLICY_NAME:-GitHubActionsDeployPolicy}"
OIDC_URL="https://token.actions.githubusercontent.com"
OIDC_THUMBPRINT="6938fd4d98bab03faadb97b34396831e3780aea1"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "Using AWS account: ${ACCOUNT_ID}"

if ! aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn" --output text | grep -q "oidc-provider"; then
  echo "Creating GitHub OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url "${OIDC_URL}" \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list "${OIDC_THUMBPRINT}" >/dev/null
else
  echo "GitHub OIDC provider already exists."
fi

TRUST_DOC="$(mktemp)"
cat >"${TRUST_DOC}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${OWNER}/${REPO}:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOF

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "Role exists, updating trust policy..."
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "file://${TRUST_DOC}" >/dev/null
else
  echo "Creating role ${ROLE_NAME}..."
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "file://${TRUST_DOC}" \
    --description "GitHub Actions deploy role for ${OWNER}/${REPO}" >/dev/null
fi

PERM_DOC="$(mktemp)"
cat >"${PERM_DOC}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["ec2:*", "rds:*", "s3:*", "cloudfront:*"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["iam:CreateServiceLinkedRole", "iam:PassRole"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["sts:GetCallerIdentity"], "Resource": "*" }
  ]
}
EOF

echo "Putting inline policy ${POLICY_NAME}..."
aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${PERM_DOC}" >/dev/null

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo ""
echo "Done."
echo "Set GitHub secret AWS_DEPLOY_ROLE_ARN = ${ROLE_ARN}"
echo "Also set: DB_PASSWORD, JWT_SECRET, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, EC2_SSH_PRIVATE_KEY"

rm -f "${TRUST_DOC}" "${PERM_DOC}"
