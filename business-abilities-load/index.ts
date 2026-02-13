import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");

// API Rate Limit Configuration
// From config/config.exs: cap: 10,000 points, per_second: 50 points This means the API can handle ~50 requests/second sustained
// To stay safely under the limit, we'll target ~40 requests/second max
const RATE_LIMIT_PER_SECOND = 50; // API limit
const TARGET_REQUESTS_PER_SECOND = 40; // Our target (80% of limit for safety)

// Test configuration
export const options = {
  // Use a constant arrival rate to stay under the rate limit
  // This ensures we don't exceed TARGET_REQUESTS_PER_SECOND regardless of response times
  scenarios: {
    constant_rate: {
      executor: "constant-arrival-rate",
      rate: TARGET_REQUESTS_PER_SECOND, // iterations per second
      timeUnit: "1s",
      duration: "10m", // Run at constant rate for 10 minutes
      preAllocatedVUs: 50, // Pre-allocate VUs for performance
      maxVUs: 100, // Maximum VUs to scale up to if needed
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests should be below 2s
    http_req_failed: ["rate<0.05"], // Error rate should be less than 5%
    errors: ["rate<0.05"], // Custom error rate should be less than 5%
    iteration_duration: ["p(95)<3000"], // Iterations should complete within 3s
  },
};

// GraphQL query to test
const query = `
  query TestBusinessAbilities {
    business {
      abilities {
        manage
      }
    }
  }
`;

// Configuration - UPDATE THESE VALUES
const BASE_URL = __ENV.BASE_URL || "http://localhost:4000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";
const STAFF_ID = __ENV.STAFF_ID || "";

export default function () {
  // Prepare the GraphQL request
  const payload = JSON.stringify({
    query: query,
    variables: {},
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      // Add authentication headers based on your app's requirements
      // The business_graph_api pipeline requires authentication via ReadTokenAuth or ReadSessionAuth
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "X-Staff-Id": STAFF_ID,
    },
    tags: {
      name: "BusinessAbilitiesQuery",
    },
  };

  // Make the GraphQL request
  const response = http.post(`${BASE_URL}/api/v1.0/graph`, payload, params);

  // Validate the response
  const success = check(response, {
    "status is 200": (r) => r.status === 200,
    "response has data": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.data !== undefined;
      } catch {
        return false;
      }
    },
    "business.abilities exists": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.data?.business?.abilities !== undefined;
      } catch {
        return false;
      }
    },
    "manage is boolean": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        const businessManage = body.data?.business?.abilities?.manage;
        return typeof businessManage === "boolean";
      } catch {
        return false;
      }
    },
    "no errors in response": (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return !body.errors || body.errors.length === 0;
      } catch {
        return false;
      }
    },
  });

  // Track errors
  errorRate.add(!success);

  // Check for rate limit headers in response
  const rateLimitRemaining = response.headers["Ratelimit"];
  if (rateLimitRemaining) {
    // Parse the header to check remaining quota
    // Format: "default";r=<remaining>;t=<reset_seconds>
    const match = rateLimitRemaining.match(/r=(\d+)/);
    if (match && parseInt(match[1]) < 100) {
      console.warn(
        `Rate limit warning: Only ${match[1]} requests remaining in quota`,
      );
    }
  }

  // No sleep needed - the constant-arrival-rate executor handles pacing
  // to maintain exactly TARGET_REQUESTS_PER_SECOND
}

// Setup function - runs once per VU at the start
export function setup() {
  console.log("Starting load test...");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Rate Limit: ${RATE_LIMIT_PER_SECOND} requests/second`);
  console.log(
    `Target Rate: ${TARGET_REQUESTS_PER_SECOND} requests/second (${(TARGET_REQUESTS_PER_SECOND / RATE_LIMIT_PER_SECOND) * 100}% of limit)`,
  );
  console.log(`Duration: 10 minutes`);
  console.log(
    `Total Expected Requests: ${TARGET_REQUESTS_PER_SECOND * 60 * 10} requests`,
  );

  // Verify authentication is configured
  if (!AUTH_TOKEN) {
    console.warn(
      "WARNING: AUTH_TOKEN not set. Requests will likely fail authentication.",
    );
  }

  return {
    startTime: new Date().toISOString(),
  };
}

// Teardown function - runs once at the end
export function teardown(data: any) {
  console.log("Load test completed.");
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}
