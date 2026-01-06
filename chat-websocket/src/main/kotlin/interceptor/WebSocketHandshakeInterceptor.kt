package com.chat.websocket.interceptor

import org.slf4j.LoggerFactory
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.stereotype.Component
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import java.lang.Exception
import kotlin.text.toLongOrNull

@Component
class WebSocketHandshakeInterceptor : HandshakeInterceptor {
    private val logger = LoggerFactory.getLogger(WebSocketHandshakeInterceptor::class.java)

    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String?, Any?>,
    ): Boolean {
        return try {
            // ws://localhost:8080/chat?userId=123
            val uri = request.uri
            val query = uri.query

            if (query != null) {
                val param = parseQuery(query)
                val userId = param["userId"]?.toLongOrNull()

                if (userId != null) {
                    attributes["userId"] = userId
                    true
                }else {
                    false
                }
            } else {
                false
            }
        } catch (e: Exception) {
            logger.error(e.message, e)
            false
        }
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) {
        if (exception != null) {
            logger.error("WebSocket HandshakeInterceptor exception", exception)
        }else {
            logger.info("WebSocket HandshakeInterceptor")
        }
    }

    private fun parseQuery(query: String): Map<String, String> {
        return query.split("&")
            .mapNotNull { param ->
                val parts = param.split("=", limit = 2)
                if (parts.size == 2) {
                    parts[0] to parts[1]
                } else null
            }
            .toMap()
    }
}