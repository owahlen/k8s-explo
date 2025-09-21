const {exec} = require('child_process');

// run with: kubectl get pods -l app=forward-service-node -o name | head -1 | xargs node aged-connections.js

// ANSI color codes
const GREEN = '\x1b[32m'; // New ports
const WHITE = '\x1b[37m'; // Active ports
const ORANGE = '\x1b[38;5;208m'; // Older than 10 seconds
const PURPLE = '\x1b[35m'; // Older than 60 seconds
const RED = '\x1b[31m'; // Older than 4 minutes
const GRAY = '\x1b[90m'; // Disconnected ports
const RESET = '\x1b[0m';

const podName = process.argv[2];
const columns = process.argv[3] ? parseInt(process.argv[3]) : 10;
const NEW_PORT_DURATION_MS = 2 * 1000;
const ORANGE_PORT_DURATION_MS = 20 * 1000;
const PURPLE_PORT_DURATION_MS = 60 * 1000;
const RED_PORT_DURATION_MS = 4 * 60 * 1000;
const DISCONNECTED_PORT_DURATION_MS = 5 * 1000;

// the port of the service the agent communicates with
const DESTINATION_PORT = 3000;

if (!podName) {
    console.error('Error: Please provide a pod name as a command-line argument.');
    console.error('Usage: node your-script-name.js <pod-name> [columns]');
    process.exit(1);
}

// Stores the state of each port
const portState = new Map();

function extractPort(ipPort) {
    return ipPort.substring(ipPort.lastIndexOf(':') + 1);
}

// Function to get and return raw data from the pod
function getRawPortData(callback) {
    const command = `kubectl exec -i ${podName} -- sh -c "ss -tan | grep ESTAB || true"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            process.exit(1);
        }
        const outputLines = stdout.trim().split('\n');
        const ports = new Set();
        outputLines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 4) {
                const sourcePort = extractPort(parts[3]);
                const destinationPort = extractPort(parts[4]);
                if (destinationPort === String(DESTINATION_PORT)) {
                    ports.add(sourcePort);
                }
            }
        });
        callback(Array.from(ports));
    });
}

// Function to process data and update state
function processPortData(currentPortsArray) {
    const currentPorts = new Set(currentPortsArray);
    const now = Date.now();
    const portsToDisplay = new Set();

    // Clean up ports that have been disconnected for too long
    const portsToRemove = [];
    portState.forEach((state, port) => {
        if (state.disconnectedSince && (now - state.disconnectedSince) >= DISCONNECTED_PORT_DURATION_MS) {
            portsToRemove.push(port);
        }
    });
    portsToRemove.forEach(port => portState.delete(port));

    // Update state for currently open ports
    currentPorts.forEach(port => {
        const currentState = portState.get(port);

        if (!currentState || currentState.disconnectedSince) {
            // New port or port that reappears after being disconnected
            portState.set(port, {firstSeen: now});
        }
        // add currently open ports to the portsToDisplay set
        portsToDisplay.add(port);
    });

    // Identify and handle disconnected ports
    portState.forEach((state, port) => {
        if (!currentPorts.has(port) && !state.disconnectedSince) {
            // First time seeing this port disconnected, flag it
            state.disconnectedSince = now;
            portState.set(port, state);
        }
        portsToDisplay.add(port);
    });

    return Array.from(portsToDisplay);
}

// Function to format and dump the output
function dumpOutput(portsToDisplay) {
    const sortedPorts = portsToDisplay.sort((a, b) => parseInt(a) - parseInt(b));
    const currentTime = new Date().toLocaleTimeString();

    console.clear();
    console.log(`[${currentTime}] Ports on "${podName}":`);

    let gridOutput = '';
    let count = 0;
    sortedPorts.forEach(port => {
        const state = portState.get(port);
        let color = WHITE;

        if (!state) {
            return;
        }

        if (state.disconnectedSince) {
            color = GRAY;
        } else if ((Date.now() - state.firstSeen) < NEW_PORT_DURATION_MS) {
            color = GREEN;
        } else if ((Date.now() - state.firstSeen) >= RED_PORT_DURATION_MS) {
            color = RED;
        } else if ((Date.now() - state.firstSeen) >= PURPLE_PORT_DURATION_MS) {
            color = PURPLE;
        } else if ((Date.now() - state.firstSeen) >= ORANGE_PORT_DURATION_MS) {
            color = ORANGE;
        }

        gridOutput += `${color}${port.padEnd(6)}${RESET}`;
        count++;
        if (count % columns === 0) {
            gridOutput += '\n';
        }
    });

    if (sortedPorts.length > 0) {
        console.log(gridOutput);
    } else {
        console.log("None");
    }
}

// Main function to orchestrate the calls
function main() {
    getRawPortData((ports) => {
        const portsToDisplay = processPortData(ports);
        dumpOutput(portsToDisplay);
    });
}

setInterval(main, 1000);