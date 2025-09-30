# ---- Build ----
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace
COPY gradle gradle
COPY gradlew settings.gradle.kts build.gradle.kts ./
RUN ./gradlew --version
RUN ./gradlew -x test build || return 0
COPY src src
RUN ./gradlew clean bootJar -x test

# ---- Run ----
FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
RUN apk add --no-cache iproute2 curl
COPY --from=build /workspace/build/libs/*-SNAPSHOT.jar app.jar

ENV JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"
EXPOSE 8080
USER 1000
ENTRYPOINT ["java","-jar","/app/app.jar"]
