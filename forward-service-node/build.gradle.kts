import com.github.gradle.node.npm.task.NpmTask

plugins {
    id("base")
    id("com.github.node-gradle.node")
}

node {
    download.set(false)
    nodeProjectDir.set(projectDir)
}

val npmCi by tasks.registering(NpmTask::class) {
    description = "Installs Node dependencies using npm ci"
    npmCommand.set(listOf("ci"))
    inputs.file("package-lock.json")
    outputs.dir("node_modules")
}

val npmBuild by tasks.registering(NpmTask::class) {
    description = "Runs npm run build"
    dependsOn(npmCi)
    npmCommand.set(listOf("run", "build"))
    inputs.dir("src")
    inputs.file("vite.config.ts")
    outputs.dir("dist")
}

val test by tasks.registering(NpmTask::class) {
    description = "Runs npm test"
    group = "verification"
    dependsOn(npmCi)
    npmCommand.set(listOf("run", "test"))
}

tasks.named("build") {
    dependsOn(npmBuild)
}

tasks.named("check") {
    dependsOn(test)
}

tasks.register<Exec>("dockerBuild") {
    group = "docker"
    description = "Builds the Docker image"
    workingDir = projectDir
    commandLine("docker", "build", "-t", "owahlen/forward-service-node:dev", ".")
}
