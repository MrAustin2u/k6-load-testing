# k6 Load Test for query business.abilities on BlvdGraph

This directory contains k6 load tests for testing the BLVD GraphQL API.

## Test: `feature-flags-business-groups-load.ts`

This test performs 10,000 GraphQL requests to the `business { abilities { manage }}` query to test the feature flags business groups system under load.

### Prerequisites

1. **Install k6**: Follow the installation instructions at https://k6.io/docs/getting-started/installation/

   ```bash
   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Get Authentication Credentials**: You need to obtain:
   - An authentication token (Bearer token)
   - A staff ID (for the X-Staff-Id header)

   You can get these from your local development environment or from a test account.

### Setup

1. **Create your .env file**:

   ```bash
   cd ~/code/k6
   cp .env.example .env
   ```

2. **Edit .env with your credentials**:

   Open `.env` in your editor and fill in your actual values:

   ```bash
   BASE_URL=http://localhost:4000
   AUTH_TOKEN=your_actual_bearer_token
   STAFF_ID=your_actual_staff_id
   ```

   **How to get these values:**
   - **AUTH_TOKEN**: Open your browser's DevTools (Network tab), log into the BLVD dashboard, and look for the `Authorization` header in GraphQL requests
   - **STAFF_ID**: Check the `X-Staff-Id` header in the same requests, or query `currentUser { staff { id } }` in GraphiQL

### Running the Test

#### Recommended: Using the Shell Script (Easiest)

The easiest way to run the test is using the provided shell script, which automatically loads your `.env` file:

```bash
cd ~/code/k6
./run-load-test.sh
```

This script will:

- Load environment variables from `.env`
- Validate that credentials are set
- Display your configuration (with masked token)
- Run the k6 test

You can also pass additional k6 options:

```bash
# Run with custom output
./run-load-test.sh --out json=results.json

# Run with increased verbosity
./run-load-test.sh --verbose
```

#### Alternative: Manual Environment Variables

If you prefer not to use a `.env` file, you can pass environment variables directly:

```bash
k6 run \
  -e BASE_URL=http://localhost:4000 \
  -e AUTH_TOKEN=your_bearer_token_here \
  -e STAFF_ID=your_staff_id_here \
  feature-flags-business-groups-load.ts
```

#### Testing Against Staging

Update your `.env` file:

```bash
BASE_URL=https://staging.blvd.co
AUTH_TOKEN=your_staging_token
STAFF_ID=your_staging_staff_id
```

Then run:

```bash
./run-load-test.sh
```

### Test Configuration

The test is configured to respect the API rate limits defined in `config/config.exs`:

- **API Rate Limit**: 50 requests/second (cap: 10,000 points, per_second: 50 points)
- **Test Target Rate**: 40 requests/second (80% of limit for safety margin)

The test uses k6's `constant-arrival-rate` executor to:

1. **Maintain a constant rate** of 40 requests/second for 10 minutes
2. **Automatically scale VUs** (Virtual Users) as needed to maintain this rate
3. **Monitor rate limit headers** and warn if approaching quota exhaustion

**Key characteristics:**

- **Duration**: 10 minutes of sustained load
- **Total Requests**: ~24,000 requests (40 req/s × 600 seconds)
- **Rate Limiting**: Test will never exceed the API's rate limit
- **Safety Margin**: Running at 80% of capacity leaves headroom for other traffic

### Performance Thresholds

The test includes the following thresholds:

- **Response time (p95)**: 95% of requests should complete in under 2 seconds
- **Error rate**: Less than 5% of requests should fail
- **Custom errors**: Less than 5% of checks should fail

If any threshold is exceeded, the test will fail.

### Modifying the Test

#### Adjusting Request Rate

To change the target request rate, edit the constants at the top of the test file:

```typescript
const RATE_LIMIT_PER_SECOND = 50; // API limit from config
const TARGET_REQUESTS_PER_SECOND = 40; // Your target rate
```

Then update the scenario configuration:

```typescript
scenarios: {
  constant_rate: {
    executor: "constant-arrival-rate",
    rate: TARGET_REQUESTS_PER_SECOND,
    duration: "10m", // Adjust duration as needed
    preAllocatedVUs: 50,
    maxVUs: 100,
  },
}
```

**Important**: Always keep `TARGET_REQUESTS_PER_SECOND` below `RATE_LIMIT_PER_SECOND` to avoid hitting rate limits!

#### Changing the GraphQL Query

Modify the `query` constant to test different queries:

```typescript
const query = `
  query TestBusinessAbilities {
    business {
      abilities {
        manage
      }
    }
  }
`;
```

#### Rate Limit Monitoring

The test monitors the API's rate limit headers in real-time:

```typescript
// The test checks the 'Ratelimit' response header
// Format: "default";r=<remaining>;t=<reset_seconds>
// Warnings are logged if remaining quota drops below 100
```

You can view rate limit information in the k6 output and response headers during the test.

### Understanding Results

k6 will output real-time metrics during the test and a summary at the end:

```
     data_received..................: 13 MB  21 kB/s
     data_sent......................: 7.2 MB 12 kB/s
     http_req_blocked...............: avg=1.2ms   min=0s      med=0s      max=500ms   p(95)=5ms
     http_req_connecting............: avg=800µs   min=0s      med=0s      max=300ms   p(95)=3ms
     http_req_duration..............: avg=150ms   min=50ms    med=120ms   max=5s      p(95)=450ms
     http_req_failed................: 0.50%   ✓ 50    ✗ 9950
     http_reqs......................: 10000   16.67/s
     iteration_duration.............: avg=1.15s   min=1.05s   med=1.12s   max=6s      p(95)=1.45s
     iterations.....................: 10000   16.67/s
     vus............................: 100     min=1   max=10000
     vus_max........................: 10000   min=10000 max=10000
```

Key metrics to watch:

- `http_req_duration`: How long requests take
- `http_req_failed`: Percentage of failed requests
- `http_reqs`: Total number of requests and requests per second
- `errors`: Custom error rate from our checks

### Troubleshooting

#### Authentication Failures

If you see many 401 or 403 errors, your authentication credentials may be incorrect or expired. Verify:

1. The `AUTH_TOKEN` is valid
2. The `STAFF_ID` is correct
3. The token has the necessary permissions to query `business.abilities.manage`

#### Connection Errors

If you see connection errors:

1. Verify the `BASE_URL` is correct and accessible
2. Check that your network can reach the target server
3. Consider reducing the number of virtual users if overwhelming the server

#### Timeout Errors

If requests are timing out:

1. The server may be overloaded - reduce the target VU count
2. Increase the timeout threshold in the test
3. Check server logs for performance issues

### Best Practices

1. **Start small**: Test with a smaller load profile first to verify everything works
2. **Monitor the server**: Watch server metrics (CPU, memory, database connections) during the test
3. **Coordinate with team**: Ensure you have permission to run load tests, especially against shared environments
4. **Document results**: Save k6 output and server metrics for analysis
5. **Iterate**: Adjust the test based on findings and run multiple times for consistency

### Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
