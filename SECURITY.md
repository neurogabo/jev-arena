# Security

Never put API keys, database copies, player traces or private deployment details in an issue or pull request. Keep `.env` local and ignored. If a credential is accidentally published, revoke or rotate it at its provider; deleting a file does not revoke the credential or erase Git history.

For a vulnerability involving private information, contact the repository maintainer through a private channel. Use GitHub's private vulnerability reporting if it is enabled for the repository. Share a minimal reproduction with synthetic data, without credentials or player records.

The local app binds to loopback by default. Public hosting requires HTTPS, deliberate origin/proxy configuration, usage limits, a private data volume and independent deployment credentials. Dependencies and downloaded Showdown code retain their own update and security requirements.
