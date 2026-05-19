# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial SDK scaffold: `AleoClient`, `ProgramService`, `ProgramCallBuilder`,
  `TransactionService`, encoders/decoders, `SodaxWalletAdapter`, and
  `InMemoryWalletAdapter`.
- Strict TypeScript config, ESLint + Prettier, Vitest with 80% coverage
  thresholds.
- GitHub Actions CI matrix (Node 18 / 20 / 22).
