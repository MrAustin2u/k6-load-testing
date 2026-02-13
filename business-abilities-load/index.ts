import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");

// Test configuration
interface K6Options {
  tags: {
    name: string;
  };
  stages: Array<{
    duration: string;
    target: number;
  }>;
  thresholds: {
    http_req_duration: string[];
    http_req_failed: string[];
    errors: string[];
  };
  setupTimeout: string;
}

export const options: K6Options = {
  tags: {
    name: "BusinessAbilitiesLoadTest",
  },
  stages: [
    { duration: "30s", target: 100 }, // Warm-up phase
    { duration: "1m", target: 1000 }, // Ramp-up
    { duration: "3m", target: 5000 }, // Sustained load
    { duration: "2m", target: 8000 }, // Increased load
    { duration: "1m", target: 10000 }, // Peak load to test system limits
    { duration: "1m", target: 5000 }, // Ramp-down
    { duration: "30s", target: 0 }, // Cool-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests should be below 2s
    http_req_failed: ["rate<0.01"], // Error rate should be less than 1%
    errors: ["rate<0.01"], // Custom error rate should be less than 1%
  },
  setupTimeout: "5m", // 5 minutes timeout for setup
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

  // Small sleep between iterations to prevent overwhelming the system
  sleep(1);
}

// Setup function - runs once at the start
export function setup() {
  console.log("Starting load test...");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test: ${options.tags.name}`);
  console.log(`Stages: ${options.stages.length} stages over ~9 minutes`);
  console.log(`Peak VUs: 10,000`);

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
