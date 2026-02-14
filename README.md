# k6 Load Testing Suite

A collection of k6 load testing scripts for performance testing and capacity planning.

## Overview

This repository contains load testing scenarios built with [k6](https://k6.io/), an open-source load testing tool. The tests are designed to validate API performance, identify bottlenecks, and ensure systems can handle expected traffic loads.

## Repository Structure

```
k6-load-testing/
├── business-abilities-load/     # Business abilities load test scenario
│   ├── index.ts                 # Main k6 test script
│   ├── run-load-test.sh         # Convenience script to run tests
│   ├── README.md                # Test-specific documentation
│   ├── .env.example             # Environment configuration template
│   └── RATE_LIMIT_CONFIG.md     # Rate limiting documentation
└── README.md                    # This file
```

## Getting Started

### Prerequisites

1. **Install k6**: Follow the installation instructions at https://k6.io/docs/getting-started/installation/

   ```bash
   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Configure environment variables**: Each test directory contains its own setup instructions and `.env` configuration.

### Running Tests

Navigate to the specific test directory and follow its README for detailed instructions:

```bash
cd <test-directory>
./run-load-test.sh
```

## Test Directories

Each test directory contains a specific load testing scenario. Navigate to individual test directories and review their README files for detailed documentation on:

- Test objectives and target endpoints
- Configuration requirements
- Rate limiting considerations
- Performance thresholds
- Expected results

## Best Practices

1. **Always coordinate with your team** before running load tests against shared environments
2. **Start with smaller loads** to verify configuration before scaling up
3. **Monitor server metrics** (CPU, memory, database connections) during tests
4. **Document your results** for analysis and future reference
5. **Never run load tests against production** without explicit approval and planning

## Adding New Tests

When creating a new test suite:

1. Create a new directory for your test scenario
2. Include a detailed README.md with:
   - Test purpose and scope
   - Prerequisites and setup instructions
   - Configuration options
   - Expected results and thresholds
3. Provide example `.env.example` files for configuration
4. Include helper scripts for common operations
5. Update this root README with a link to your test

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Test Types](https://k6.io/docs/test-types/introduction/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)

## Contributing

When adding or modifying tests:

- Follow the existing directory structure
- Document configuration requirements clearly
- Include rate limiting considerations
- Add performance thresholds appropriate for the test scenario
- Test your scripts before committing

## License

[Add your license here]
