import http from "k6/http";
import {sleep} from "k6";

export let options = {
    scenarios: {
        constant_load_jvm: {
            executor: "constant-arrival-rate",
            startTime: "0m", // Starts immediately
            rate: 400, // Maintain 400 requests per second
            timeUnit: "1s",
            preAllocatedVUs: 100,
            maxVUs: 500,
            duration: "2m",
            exec: "loadtestJvm",
            tags: { service: "jvm" },
        },
        constant_load_node: {
            executor: "constant-arrival-rate",
            startTime: "2m", // Starts after the previous scenario
            rate: 400, // Maintain 400 requests per second
            timeUnit: "1s",
            preAllocatedVUs: 100,
            maxVUs: 500,
            duration: "2m",
            exec: "loadtestNode",
            tags: { service: "node" },
        },
    },
};

//const BASE_URL = "http://127.0.0.1:8080";
const BASE_URL = "http://192.168.49.2";

export function loadtestJvm() {
    http.get(`${BASE_URL}/jvm/loadtest`, { tags: { endpoint: "jvm" } });
}

export function loadtestNode() {
    http.get(`${BASE_URL}/node/loadtest`, { tags: { endpoint: "node" } });
}