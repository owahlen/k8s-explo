import http from "k6/http";

export let options = {
    scenarios: {
        // mvc_load: {
        //     executor: "constant-arrival-rate",
        //     startTime: "0m",
        //     rate: 1000,
        //     timeUnit: "1s",
        //     preAllocatedVUs: 100,
        //     maxVUs: 1000,
        //     duration: "15m",
        //     exec: "mvcTest",
        // },
        webflux_load: {
            executor: "constant-arrival-rate",
            startTime: "0m",
            rate: 1000,
            timeUnit: "1s",
            preAllocatedVUs: 100,
            maxVUs: 1000,
            duration: "15m",
            exec: "webfluxTest",
        },
        // node_load: {
        //     executor: "constant-arrival-rate",
        //     startTime: "10m",
        //     rate: 1000,
        //     timeUnit: "1s",
        //     preAllocatedVUs: 100,
        //     maxVUs: 1000,
        //     duration: "5m",
        //     exec: "nodeTest",
        // },
    },
};

// Determine the BASE_URL based on the operating system
// Check if HOME directory starts with "/Users" to detect macOS
// Otherwise, assume Linux
const BASE_URL = (__ENV.HOME && __ENV.HOME.startsWith('/Users'))
    ? "http://127.0.0.1"
    : "http://192.168.49.2";

export function mvcTest() {
    http.get(`${BASE_URL}/mvc/loadtest`);
}

export function webfluxTest() {
    http.get(`${BASE_URL}/webflux/loadtest`);
}

export function nodeTest() {
    http.get(`${BASE_URL}/node/loadtest`);
}

