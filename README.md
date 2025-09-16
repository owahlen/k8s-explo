# Kubernetes Service Playground

A minimal multi-runtime setup to explore services locally and on minikube:
- echo-service-node: echoes request details (TypeScript/Express).
- forward-service-node: forwards requests to echo-service (TypeScript/Express).
- forward-service-jvm: forwards requests to echo-service (Kotlin/Spring WebFlux).

## Prerequisites
- Docker, Node.js 22+ and npm
- k6 for load testing

## Repo Layout
- `echo-service-node/`: echo service (Vite build, Vitest tests)
- `forward-service-node/`: forwards to echo-service (same stack)
- `forward-service-jvm/`: forwards to echo-service (Spring Boot WebFlux)
- `k8s-explo.yaml`: Deployments, Services (ClusterIP), and Ingress for Node services
- `http/`: sample requests

## Develop & Test Locally
### Initial Setup
* [Install minikube](https://minikube.sigs.k8s.io/docs/start/)
* [Install kubectl](https://kubernetes.io/docs/tasks/tools/) in a matching version
* [Install helm](https://helm.sh/docs/intro/install/)
* Start the cluster: `minikube start --addons=metrics-server --addons=dashboard --addons=ingress`
* Start the dashboard (optional): `minikube dashboard`

### Install Monitoring and Tracing
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

export POD_NAME=$(kubectl --namespace monitoring get pod -l "app.kubernetes.io/name=grafana,app.kubernetes.io/instance=monitoring" -oname)
kubectl -n monitoring port-forward $POD_NAME 3000
kubectl -n monitoring apply -f otel-collector.yaml
```
The `grafana` folder contains dashboards that can be imported.

### Running the services
Run the services locally without minikube:
```bash
cd echo-service-node
npm ci
npm run dev     # hot-reload on http://localhost:3000
npm test        # Vitest + Supertest

# In a second terminal
cd forward-service-node
npm i
ECHO_BASE_URL=http://localhost:3000 npm run dev   # http://localhost:3001
npm test

# In a third terminal (JVM forwarder)
cd ../forward-service-jvm
./gradlew test
ECHO_BASE_URL=http://localhost:3000 ./gradlew bootRun   # http://localhost:8080 by default
```
Quick checks:
- Echo (Node): `curl "http://localhost:3000/?client=test"`
- Forward-node (POST): `curl -X POST 'http://localhost:3001/echo/test' -H 'content-type: application/json' -d '{"hello":"world"}'`
- Forward-jvm (POST): `curl -X POST 'http://localhost:8080/echo/test' -H 'content-type: application/json' -d '{"hello":"world"}'`
- Health (JVM Actuator): `curl 'http://localhost:8080/actuator/health'`

## Build & Containerize (Node images)
```bash
cd echo-service-node
npm run build
docker build -t owahlen/echo-service-node:1.0 .
docker push owahlen/echo-service-node:1.0 # optional

cd ../forward-service-node
npm run build
docker build -t owahlen/forward-service-node:1.0 .
docker push owahlen/echo-service-node:1.0 # optional

cd ../forward-service-jvm
docker build -t owahlen/forward-service-jvm:1.0 .
docker push owahlen/forward-service-jvm:1.0
```

## Deploy to minikube
1) Enable ingress (once):
```bash
minikube addons enable ingress
```
On macOS it is also necessary to enable a minikube tunnel:
```bash
minikube tunnel # start the tunnel
minikube ip # retrieve the tunnel IP
```
2) Make the images available to the cluster. Choose one:
- Build inside Minikube’s Docker daemon:
```bash
eval $(minikube docker-env)
docker build -t owahlen/echo-service:1.0 echo-service-node
docker build -t owahlen/forward-service:1.0 forward-service-node
```
- Or load a local image:
```bash
minikube image load owahlen/echo-service:1.0
kubectl set image deployment/echo-service echo-service=echo-service:1.0 --record || true
minikube image load owahlen/forward-service:1.0
kubectl set image deployment/forward-service forward-service=forward-service:1.0 --record || true
```
3) Apply manifests:
```bash
kubectl apply -f k8s-explo.yaml
kubectl get pods,svc,ingress
```
4) Verify traffic:
```bash
MINIKUBE_IP=$(minikube ip)
curl "http://$MINIKUBE_IP/echo/?client=test"
curl -X POST "http://$MINIKUBE_IP/forward/test" -H 'content-type: application/json' -d '{"through":"forward"}'
```
(Alternatively, open `http/echo.http` in an HTTP client.)

5) List all pods, login onto a pod and show connections
```bash
kubectl get pods -n default
kubectl -n default exec -it <name of pod> -- sh
ss -tanp
```

## Configuration & Health
- Env (echo-node): `PORT` (3000), `LOG_LEVEL` (`info`)
- Env (forward-node): `PORT` (3001), `ECHO_BASE_URL` (defaults to `http://localhost:3000`; set to `http://echo-service:3000` in cluster)
- Env (forward-jvm): `ECHO_BASE_URL` (defaults to `http://localhost:3000`)
- Probes: readiness/liveness and resource limits defined in `k8s-explo.yaml` (Node services)
- Containers run as non-root

## Update & Cleanup
- Update image: rebuild, then `kubectl set image deployment/echo-service echo-service=<new>:<tag>`
- Remove: `kubectl delete -f k8s-explo.yaml`

## Load testing
```bash
cd loadtest
k6 run test.js
```
