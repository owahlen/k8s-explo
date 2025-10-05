plugins {
    id("com.github.node-gradle.node") version "7.1.0" apply false
}

allprojects {
    group = "org.owahlen"
    version = "0.0.1-SNAPSHOT"
}

subprojects {
    repositories {
        mavenCentral()
    }
}
