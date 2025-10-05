# ---- Build ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

# Copy project independent build system files first to leverage Docker layer caching
COPY gradle gradle
COPY gradlew ./
RUN chmod +x gradlew
RUN ./gradlew --no-daemon --version

# Copy build configuration files
RUN mkdir -p echo-service-node forward-service-node forward-service-mvc
COPY settings.gradle.kts build.gradle.kts ./
COPY forward-service-webflux/build.gradle.kts forward-service-webflux/
COPY forwarddb/build.gradle.kts forwarddb/

# Copy application sources (invalidate cache only when sources change)
COPY forwarddb/src forwarddb/src
COPY forward-service-webflux forward-service-webflux

# Build the application
RUN ./gradlew :forward-service-webflux:bootJar -x test --no-daemon

# ---- Run ----
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
RUN apk add --no-cache iproute2 curl
COPY --from=build /workspace/forward-service-webflux/build/libs/*-SNAPSHOT.jar app.jar

ENV JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"
EXPOSE 8080
USER 1000
ENTRYPOINT ["java","-jar","/app/app.jar"]
