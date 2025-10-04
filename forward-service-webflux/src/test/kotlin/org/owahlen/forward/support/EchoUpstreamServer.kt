package org.owahlen.forward.support

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.test.context.DynamicPropertyRegistry
import reactor.core.publisher.Mono
import reactor.netty.DisposableServer
import reactor.netty.http.server.HttpServer

object EchoUpstreamServer {
    private val mapper = ObjectMapper()
    private val lock = Any()
    private var server: DisposableServer? = null

    private fun startServer(): DisposableServer =
        HttpServer.create()
            .port(0)
            .route { routes ->
                routes.route({ true }) { req, res ->
                    req.receive().aggregate().asString().defaultIfEmpty("").flatMap { body ->
                        val responseMap = mutableMapOf<String, Any>(
                            "method" to req.method().name(),
                            "url" to req.uri()
                        )

                        if (body.isNotBlank()) {
                            val bodyValue: Any = try {
                                mapper.readTree(body)
                            } catch (_: Exception) {
                                body
                            }
                            responseMap["body"] = bodyValue
                        }

                        val json = mapper.writeValueAsString(responseMap)
                        res.header("content-type", "application/json")
                            .sendString(Mono.just(json))
                            .then()
                    }
                }
            }
            .bindNow()

    private fun ensureServer(): DisposableServer =
        server ?: synchronized(lock) {
            server ?: startServer().also { server = it }
        }

    fun registerBaseUrl(registry: DynamicPropertyRegistry) {
        val running = ensureServer()
        registry.add("FORWARD_BASE_URL") { "http://localhost:${running.port()}" }
    }

    fun shutdown() {
        synchronized(lock) {
            server?.disposeNow()
            server = null
        }
    }
}
