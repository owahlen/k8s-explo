# ---- Build ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

# Copy the full multi-project workspace so Gradle can resolve all modules
COPY . .
RUN chmod +x gradlew
RUN ./gradlew :forward-service-webflux:bootJar -x test

# ---- Run ----
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
RUN apk add --no-cache iproute2 curl
COPY --from=build /workspace/forward-service-webflux/build/libs/*-SNAPSHOT.jar app.jar

ENV JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"
EXPOSE 8080
USER 1000
ENTRYPOINT ["java","-jar","/app/app.jar"]
