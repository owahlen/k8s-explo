package org.owahlen.forward

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class ForwardServiceApplication

fun main(args: Array<String>) {
	runApplication<ForwardServiceApplication>(*args)
}
