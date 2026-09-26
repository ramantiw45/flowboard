package com.taskboard.config;

import com.taskboard.websocket.CookieHandshakeInterceptor;
import com.taskboard.websocket.JwtChannelInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

/**
 * STOMP-over-SockJS configuration.
 *
 * Endpoint:    /ws-board          (SockJS fallback enabled)
 * Broker:      /topic/**          (server -> client broadcasts, e.g. /topic/board/{boardId})
 * App prefix:  /app/**            (optional client -> server STOMP messages)
 *
 * Authentication: the WebSocket session is authenticated from the auth cookie
 * during the HTTP handshake (see {@link CookieHandshakeInterceptor}). A CONNECT
 * frame may alternatively carry "Authorization: Bearer &lt;JWT&gt;" for
 * non-browser clients; either way {@link JwtChannelInterceptor} enforces it on
 * the client inbound channel.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtChannelInterceptor jwtChannelInterceptor;
    private final CookieHandshakeInterceptor cookieHandshakeInterceptor;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-board")
                .setAllowedOriginPatterns(Arrays.stream(allowedOrigins.split(","))
                        .map(String::trim)
                        .toArray(String[]::new))
                // Reads the auth cookie off the handshake request so the STOMP
                // CONNECT frame does not need a readable token.
                .addInterceptors(cookieHandshakeInterceptor)
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(jwtChannelInterceptor);
    }
}
