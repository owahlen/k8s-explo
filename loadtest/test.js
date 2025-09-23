import http from "k6/http";
import {sleep} from "k6";

export let options = {
    scenarios: {
        ramp_up: {
            executor: "ramping-arrival-rate",
            startTime: "0s",
            startRate: 1, // Start at 1 request per second
            timeUnit: "1s",
            preAllocatedVUs: 50,
            maxVUs: 500,
            stages: [
                {duration: "1m", target: 400}, // Ramp up to 400 requests/s over 2 minutes
            ],
        },
        constant_load: {
            executor: "constant-arrival-rate",
            startTime: "1m", // Starts after the ramp-up stage
            rate: 400, // Maintain 400 requests per second
            timeUnit: "1s",
            preAllocatedVUs: 100,
            maxVUs: 500,
            duration: "10m", // Stay at this rate for 5 minutes
        },
    },
};

// Determine the BASE_URL based on the operating system
// Check if HOME directory starts with "/Users" to detect macOS
// Otherwise, assume Linux
const BASE_URL = (__ENV.HOME && __ENV.HOME.startsWith('/Users'))
    ? "http://127.0.0.1"
    : "http://192.168.49.2";

// Construct the final URL by adding the path to the BASE_URL
const URL = `${BASE_URL}/jvm/loadtest`;

export default function () {
    http.get(URL);
    sleep(1); // wait 1 second between requests per VU
}
