
# BioShield Enterprise Backend

## 1. Architecture & Security Summary

**Overview**
- **Framework**: Express + TypeScript on Node.js
- **Database**: PostgreSQL
- **Key Management**: AWS KMS (Envelope Encryption)
- **Template Protection**: Server-side HMAC-based cancellable transforms

**Security Model**
- **Data at Rest**: Biometric templates are encrypted with a unique per-record Data Encryption Key (DEK). The DEK itself is encrypted using a Master Key (KEK) stored in AWS KMS. The database only stores:
  - `encrypted_template`
  - `encrypted_data_key`
  - `template_fingerprint` (Non-reversible HMAC)
- **Template Protection**: We derive a cancellable template using a transform key derived from the decrypted DEK. This ensures that even if the raw feature vector is compromised, the stored template cannot be reversed to the original biometric sample.
- **Transport**: Strong TLS 1.3 required. Mutual TLS (mTLS) recommended for high-assurance environments.
- **Audit**: Append-only audit logs with cryptographic signing for tamper evidence.

**Anti-Spoofing**
- Integration of liveness scores in the verification logic.
- Policies to enforce re-enrollment upon key rotation.

## 2. Production Improvements Checklist

1. **Feature Extraction**: Replace the placeholder `extractFeatures` function with enterprise-grade models (e.g., ArcFace for face, x-vectors for voice).
2. **Secure Enclave**: For highest security, run the matching logic inside an SGX or AWS Nitro Enclave.
3. **Fuzzy Matching**: Implement secure sketch or ECC-based fuzzy extractors to handle biometric variance more robustly than the demo's direct comparison.
4. **Rate Limiting**: Implement Redis-based rate limiting on `/verify` endpoints to prevent oracle attacks.

## 3. Testing & CI

- **Unit Tests**: Mock feature vectors to test crypto transforms.
- **Integration Tests**: Full flow `enroll` -> `verify` -> `revoke`.
- **Security Scans**: SAST (Static Application Security Testing) and dependency vulnerability scanning in CI/CD pipeline.

## 4. Deployment

Deploy using the provided `Dockerfile`. Recommended infrastructure:
- **Compute**: AWS ECS / Fargate or Kubernetes
- **Network**: Private subnet, exposed only via API Gateway / ALB with WAF.
- **IAM**: Restrict the task role to only `kms:GenerateDataKey` and `kms:Decrypt` on the specific Key ID.
