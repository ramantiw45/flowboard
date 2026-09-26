package com.taskboard.websocket;

import com.taskboard.security.AuthCookieService;
import com.taskboard.security.CustomUserDetailsService;
import com.taskboard.security.JwtService;
import com.taskboard.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * Authenticates the WebSocket session from the auth cookie during the HTTP
 * handshake, so the STOMP {@code CONNECT} frame does not have to carry a token.
 *
 * <p>Why this exists: the session now lives in an {@code HttpOnly} cookie, which
 * JavaScript cannot read. The old design put the JWT in the STOMP CONNECT header,
 * which required the browser to hold a readable token - exactly the thing this
 * change removes. The STOMP frame is not an HTTP request, so the browser does not
 * attach the cookie to it either.
 *
 * <p>The handshake, by contrast, <i>is</i> an ordinary HTTP request, and the
 * browser attaches the cookie to it (SockJS sets {@code withCredentials} for
 * cross-origin XHR transports). So the credential is read here, once, and the
 * resulting {@link Authentication} is stored in the WebSocket session attributes
 * where {@link JwtChannelInterceptor} can pick it up on CONNECT.
 *
 * <p>A missing or invalid cookie simply leaves the session unauthenticated. It
 * does not reject the handshake: the CONNECT frame is still authenticated, so a
 * non-browser client that sends a bearer token on CONNECT keeps working, and an
 * anonymous socket can connect but can never subscribe to a board topic.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CookieHandshakeInterceptor implements HandshakeInterceptor {

    /** Key under which the handshake authentication is stashed. */
    public static final String SESSION_AUTH_KEY = "taskboard.handshakeAuth";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final AuthCookieService authCookieService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return true;
        }
        HttpServletRequest httpRequest = servletRequest.getServletRequest();
        String token = authCookieService.readAccessToken(httpRequest);
        if (token == null || token.isBlank() || !jwtService.isTokenValid(token)) {
            // Not an error: the client may authenticate on CONNECT instead.
            return true;
        }
        try {
            UserDetails userDetails =
                    userDetailsService.loadUserByUsername(jwtService.extractUsername(token));
            Authentication authentication = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
            attributes.put(SESSION_AUTH_KEY, authentication);
            log.debug("WebSocket handshake authenticated from cookie for {}", userDetails.getUsername());
        } catch (RuntimeException ex) {
            // A token for a user that has since been deleted. Leave the socket
            // unauthenticated; CONNECT will reject it.
            log.debug("Cookie on WebSocket handshake did not resolve to a user: {}", ex.getMessage());
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // Nothing to clean up.
    }

    /** Convenience for the CONNECT handler. */
    public static Authentication from(Map<String, Object> attributes) {
        if (attributes == null) {
            return null;
        }
        Object value = attributes.get(SESSION_AUTH_KEY);
        return value instanceof Authentication authentication ? authentication : null;
    }

    /** The principal behind a handshake authentication, or null. */
    public static UserPrincipal principalOf(Authentication authentication) {
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        return principal instanceof UserPrincipal userPrincipal ? userPrincipal : null;
    }
}