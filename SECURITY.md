# Security Policy

## Supported Version

Security reports should target the current `main` branch unless a release branch is explicitly maintained.

## Reporting A Vulnerability

Do not open a public issue for a vulnerability that exposes secrets, private data, local filesystem paths, or unsafe file operations.

Report privately to:

`direccion@veltastech.com`

Include:

- A short description of the issue
- Steps to reproduce
- Affected routes or files
- Whether secrets, local videos, SQLite data, or external AI provider data are exposed
- Suggested fix if known

## Security Expectations

Raqet is self-hosted software. The operator is responsible for:

- Protecting the machine or server where Raqet runs
- Backing up SQLite databases and media files
- Securing `.env` and provider API keys
- Paying and monitoring any external AI provider usage
- Configuring HTTPS, reverse proxies, and network access if exposed beyond localhost

The default solo release should not require hosted auth, invite gates, analytics, Sentry, Supabase, managed billing, or Raqet-hosted AI infrastructure.

## Sensitive Data

Do not log API keys, access tokens, full exported private data, raw full-match video paths, or provider request payloads. Error messages should be understandable and redact secrets.
