# Kubernetes Service Playground

A minimal multi-runtime setup to explore services locally and on minikube:
- echo-service-node: echoes request details (TypeScript/Express).
- forward-service-node: forwards requests to echo-service (TypeScript/Express).
- forward-service-webflux: forwards requests to echo-service (Kotlin/Spring WebFlux).
- forward-service-mvc: forwards requests to echo-service (Kotlin/Spring MVC; blocking IO).

## Prerequisites
- Docker, Node.js 22+ and npm
- k6 for load testing

## Repo Layout
- `echo-service-node/`: echo service (Vite build, Vitest tests)
- `forward-service-node/`: forwards to echo-service (same stack)
- `forward-service-webflux/`: forwards to echo-service (Spring Boot WebFlux)
- `forward-service-mvc/`: forwards to echo-service (Spring Boot MVC)
- `k8s/`: Deployments, Services (ClusterIP), and Ingress for Node, WebFlux, and MVC services
- `http/`: sample requests

## Develop & Test Locally
### Initial Setup
* [Install minikube](https://minikube.sigs.k8s.io/docs/start/)
* [Install kubectl](https://kubernetes.io/docs/tasks/tools/) in a matching version
* [Install helm](https://helm.sh/docs/intro/install/)
* Start the cluster: `minikube start --addons=metrics-server --addons=dashboard --addons=ingress`

Find out the minikube IP:
```bash
minikube ip
```
In this document, it is assumed that this IP is `192.168.49.2`.

### Install the dashboard
```bash
kubectl apply -f k8s/monitoring/dashboard-ingress.yaml
```
The dashboard is then reachable under
http://192.168.49.2/dashboard/
with user `admin` password `prom-operator`.

### Install Monitoring and Tracing
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

#export POD_NAME=$(kubectl --namespace monitoring get pod -l "app.kubernetes.io/name=grafana,app.kubernetes.io/instance=monitoring" -oname)
#kubectl -n monitoring port-forward $POD_NAME 3000
# Install the otel-collector
kubectl -n monitoring apply -f k8s/monitoring/otel-collector.yaml

# Install the grafana-dashboard
helm upgrade monitoring prometheus-community/kube-prometheus-stack -n monitoring -f k8s/monitoring/grafana-values.yaml
kubectl apply -f k8s/monitoring/grafana-ingress.yaml
```
Grafana is then reachable under
http://192.168.49.2/grafana/

Note, that the `grafana` folder contains dashboards that can be imported.

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
FORWARD_BASE_URL=http://localhost:3000 npm run dev   # http://localhost:3001
npm test

# In a third terminal (WebFlux forwarder)
cd ../forward-service-webflux
./gradlew test
FORWARD_BASE_URL=http://localhost:3000 ./gradlew bootRun   # http://localhost:8080 by default
```
Quick checks:
- Echo (Node): `curl "http://localhost:3000/?client=test"`
- Forward-node (POST): `curl -X POST 'http://localhost:3001/echo/test' -H 'content-type: application/json' -d '{"hello":"world"}'`
- Forward-webflux (POST): `curl -X POST 'http://localhost:8080/echo/test' -H 'content-type: application/json' -d '{"hello":"world"}'`
- Health (WebFlux Actuator): `curl 'http://localhost:8080/actuator/health'`
  
# In a fourth terminal (MVC forwarder)
cd ../forward-service-mvc
./gradlew test
FORWARD_BASE_URL=http://localhost:3000 ./gradlew bootRun   # http://localhost:8080 by default
  
- Forward-mvc (POST): `curl -X POST 'http://localhost:8080/echo/test' -H 'content-type: application/json' -d '{"hello":"world"}'`
- Health (MVC Actuator): `curl 'http://localhost:8080/actuator/health'`

## Build & Containerize (Node and JVM WebFlux/MVC images)
```bash
# switch Docker context to minikube
eval $(minikube -p minikube docker-env)  # switch Docker context

docker build -t owahlen/echo-service-node:dev ./echo-service-node
kubectl rollout restart deploy echo-service-node

docker build -t owahlen/forward-service-node:dev ./forward-service-node
kubectl rollout restart deploy forward-service-node

docker build -t owahlen/forward-service-webflux:dev ./forward-service-webflux
kubectl rollout restart deploy forward-service-webflux

docker build -t owahlen/forward-service-mvc:dev ./forward-service-mvc
kubectl rollout restart deploy forward-service-mvc

# switch back Docker context
eval $(minikube -p minikube docker-env -u)
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
2) Make the images available to the cluster.
Build inside Minikube’s Docker daemon:
```bash
eval $(minikube docker-env)
docker build -t owahlen/echo-service-node:dev echo-service-node
docker build -t owahlen/forward-service-node:dev forward-service-node
docker build -t owahlen/forward-service-webflux:dev forward-service-webflux
docker build -t owahlen/forward-service-mvc:dev forward-service-mvc
```
3) Apply manifests:
```bash
kubectl apply -f k8s/app
kubectl get pods,svc,ingress
```
4) Verify traffic (via Ingress):
```bash
MINIKUBE_IP=$(minikube ip)
# Forward through Node forwarder
curl -X POST "http://$MINIKUBE_IP/node/echo/test" -H 'content-type: application/json' -d '{"through":"node"}'

# Forward through WebFlux forwarder
curl -X POST "http://$MINIKUBE_IP/webflux/echo/test" -H 'content-type: application/json' -d '{"through":"webflux"}'
curl "http://$MINIKUBE_IP/webflux/actuator/health"

# Forward through MVC forwarder
curl -X POST "http://$MINIKUBE_IP/mvc/echo/test" -H 'content-type: application/json' -d '{"through":"mvc"}'
curl "http://$MINIKUBE_IP/mvc/actuator/health"
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
- Env (forward-node): `PORT` (3001), `FORWARD_BASE_URL` (defaults to `http://localhost:3000`; set to `http://echo-service:3000` in cluster)
- Env (forward-webflux): `FORWARD_BASE_URL` (defaults to `http://localhost:3000`)
- Env (forward-mvc): `FORWARD_BASE_URL` (defaults to `http://localhost:3000`)
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
