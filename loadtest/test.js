import http from "k6/http";

export let options = {
    scenarios: {
        node_load: {
            executor: "constant-arrival-rate",
            startTime: "0m",
            rate: 400,
            timeUnit: "1s",
            preAllocatedVUs: 100,
            maxVUs: 500,
            duration: "7m",
            exec: "nodeTest",
        },
        jvm_load: {
            executor: "constant-arrival-rate",
            startTime: "7m",
            rate: 400,
            timeUnit: "1s",
            preAllocatedVUs: 100,
            maxVUs: 500,
            duration: "7m",
            exec: "jvmTest",
        },
    },
};

// Determine the BASE_URL based on the operating system
// Check if HOME directory starts with "/Users" to detect macOS
// Otherwise, assume Linux
const BASE_URL = (__ENV.HOME && __ENV.HOME.startsWith('/Users'))
    ? "http://127.0.0.1"
    : "http://192.168.49.2";

export function nodeTest() {
    http.get(`${BASE_URL}/node/loadtest`);
}

export function jvmTest() {
    http.get(`${BASE_URL}/jvm/loadtest`);
}
