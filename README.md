# Kubernetes Service Playground

A minimal TypeScript/Express setup packaged with Docker and deployed to a local minikube cluster. It includes:
- echo-service: echoes request details.
- forward-service: forwards requests to echo-service and returns its response.

## Prerequisites
- Docker, Node.js 22+ and npm
- k6 for load testing

## Repo Layout
- `echo-service/`: echo service (Vite build, Vitest tests)
- `forward-service/`: forwards to echo-service (same stack)
- `k8s-explo.yaml`: Deployments, Services (ClusterIP), and Ingress for both
- `http/`: sample requests

## Develop & Test Locally
### Initial Setup
* [Install minikube](https://minikube.sigs.k8s.io/docs/start/)
* [Install kubectl](https://kubernetes.io/docs/tasks/tools/) in a matching version
* [Install helm](https://helm.sh/docs/intro/install/)
* Start the cluster: `minicube start`
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
Run the two services locally without minikube:
```bash
cd echo-service
npm ci
npm run dev     # hot-reload on http://localhost:3000
npm test        # Vitest + Supertest

# In a second terminal
cd forward-service
npm i
ECHO_BASE_URL=http://localhost:3000 npm run dev   # http://localhost:3001
npm test
```
Quick checks:
- Echo: `curl "http://localhost:3000/?client=test"`
- Forward (POST): `curl -X POST 'http://localhost:3001/echo/test' -H 'content-type: application/json' -d '{"hello":"world"}'`

## Build & Containerize
```bash
cd echo-service
npm run build
docker build -t owahlen/echo-service:1.0 .
docker push owahlen/echo-service:1.0 # optional

cd ../forward-service
npm run build
docker build -t owahlen/forward-service:1.0 .
docker push owahlen/echo-service:1.0 # optional
```

## Deploy to minikube
1) Enable ingress (once):
```bash
minikube addons enable ingress
```
2) Make the images available to the cluster. Choose one:
- Build inside Minikube’s Docker daemon:
```bash
eval $(minikube docker-env)
docker build -t owahlen/echo-service:1.0 echo-service
docker build -t owahlen/forward-service:1.0 forward-service
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
- Env (echo): `PORT` (3000), `LOG_LEVEL` (`info`)
- Env (forward): `PORT` (3001), `ECHO_BASE_URL` (defaults to `http://localhost:3000`; set to `http://echo-service:3000` in cluster)
- Probes: readiness/liveness and resource limits defined in `k8s-explo.yaml`
- Containers run as non-root

## Update & Cleanup
- Update image: rebuild, then `kubectl set image deployment/echo-service echo-service=<new>:<tag>`
- Remove: `kubectl delete -f k8s-explo.yaml`

## Load testing
```bash
cd loadtest
k6 run test.js
```
