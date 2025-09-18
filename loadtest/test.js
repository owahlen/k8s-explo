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

// const URL="http://127.0.0.1:8080/node/loadtest"
const URL = "http://192.168.49.2/jvm/loadtest"

export default function () {
    http.get(URL);
    sleep(1); // wait 1 second between requests per VU
}
