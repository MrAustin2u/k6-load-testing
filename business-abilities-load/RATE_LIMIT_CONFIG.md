# Rate Limit Configuration

## API Rate Limits

Based on the configuration in `/Users/aaustin/BLVD/sched/config/config.exs`:

```elixir
config :blvd, BlvdPlatform.ApiQuotas,
  default_quota: %{
    cap: 10_000,        # Maximum points before throttling
    per_second: 50       # Points recovered per second
  }
```

### What This Means

- **Maximum sustained rate**: 50 requests/second
- **Burst capacity**: Up to 10,000 points (requests) before throttling begins
- **Recovery rate**: 50 points/second
- **Time to full recovery**: 200 seconds (10,000 / 50)

### How the Leaky Bucket Works

The API uses a "leaky bucket" rate limiting algorithm:

1. Each request consumes points from the bucket (typically 1 point per simple query)
2. The bucket has a capacity of 10,000 points
3. The bucket "leaks" (recovers) 50 points per second
4. If you exceed the capacity, requests are throttled/rejected

### Rate Limit Headers

The API returns these headers with each response:

- `ratelimit-policy`: Shows the quota cap and window
  - Format: `"default";q=<cap>;w=<window_seconds>`
  - Example: `"default";q=10000;w=200`

- `ratelimit`: Shows remaining quota and reset time
  - Format: `"default";r=<remaining>;t=<reset_seconds>`
  - Example: `"default";r=9500;t=10`

## Load Test Configuration

Our k6 load test is configured to stay safely under the rate limit:

### Settings

```typescript
const RATE_LIMIT_PER_SECOND = 50;      // API's actual limit
const TARGET_REQUESTS_PER_SECOND = 40;  // Our test target (80% of limit)
```

### Why 80%?

Running at 80% of the rate limit provides:

1. **Safety margin**: Prevents accidentally hitting the limit due to timing variations
2. **Headroom for other traffic**: Allows other requests (manual testing, CI/CD, etc.)
3. **Realistic testing**: Most production traffic won't max out rate limits
4. **Error margin**: Accounts for network latency and request processing time

### Test Profile

```
Duration:        10 minutes
Request rate:    40 requests/second (constant)
Total requests:  ~24,000 requests
Approach:        80% of rate limit capacity
```

### Executor Choice

The test uses k6's `constant-arrival-rate` executor instead of ramped VUs because:

1. **Guarantees rate**: Maintains exactly 40 req/s regardless of response times
2. **Rate limit friendly**: Won't accidentally burst above the target rate
3. **Predictable**: Easy to calculate total load and duration
4. **Auto-scaling**: k6 automatically adjusts VUs to maintain the rate

### Monitoring

The test actively monitors rate limit headers and will:
- Log warnings if remaining quota drops below 100 points
- Track rate limit headers in response metadata
- Fail thresholds if error rate exceeds 5%

## Adjusting for Different Environments

### Local Development
- Use the default 40 req/s target
- API typically has more capacity on localhost

### Staging
- Consider reducing to 30 req/s (60% of limit)
- Staging may be shared with other testers

### Production
- **DO NOT run this test against production**
- If absolutely necessary for load testing:
  - Coordinate with the team
  - Run during off-peak hours
  - Start with 10-20 req/s
  - Monitor server metrics carefully

## Checking Current Rate Limits

### Via GraphiQL Admin

1. Log into the admin panel
2. Navigate to `/admin/rate-limiter-quotas`
3. View quotas by business and API application

### Via API Response Headers

Make a request and check the headers:

```bash
curl -I \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Staff-Id: $STAFF_ID" \
  -X POST https://your-api.com/api/v1.0/graph \
  -d '{"query": "{ business { id } }"}'
```

Look for:
- `ratelimit-policy`: Your quota configuration
- `ratelimit`: Current remaining quota

## Complex Query Considerations

Simple queries like `business { abilities { businessManage } }` typically cost 1 point.

More complex queries may cost more points based on:
- Number of fields requested
- Depth of nested queries
- Use of connections/pagination
- Custom field complexity weights

If testing complex queries, reduce `TARGET_REQUESTS_PER_SECOND` proportionally to the query complexity.

## References

- Rate limiter implementation: `apps/blvd_web/lib/blvd_graph/rate_limiter.ex`
- Quota configuration: `config/config.exs`
- Leaky bucket algorithm: `apps/blvd_web/lib/blvd_graph/rate_limiter/leaky_bucket/leaky_bucket.ex`
