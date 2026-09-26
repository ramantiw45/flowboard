package com.taskboard.websocket;

import com.taskboard.security.CustomUserDetailsService;
import com.taskboard.security.JwtService;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.BoardAccessGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Secures the STOMP inbound channel.
 *
 * <p><b>CONNECT</b> — authenticated by whichever credential is available:
 * <ol>
 *   <li>the session established during the HTTP handshake from the auth cookie
 *       ({@link CookieHandshakeInterceptor}). This is the browser path: the
 *       access token is {@code HttpOnly}, so the client cannot read it to put in
 *       the frame, and the browser does not attach a cookie to a STOMP frame.</li>
 *   <li>{@code Authorization: Bearer &lt;token&gt;} as a native header of the
 *       CONNECT frame. This is the non-browser path and is kept deliberately, so
 *       a script, a CLI or {@code tools/wsauthcheck.mjs} can still open a socket,
 *       and so an unauthenticated handshake is not the only way in.</li>
 * </ol>
 * The resulting Authentication is attached to the WebSocket session, making the
 * user available to Spring Messaging. If neither credential is usable the
 * CONNECT is rejected, so an anonymous socket never becomes an authenticated one.
 *
 * <p><b>SUBSCRIBE</b> — every board topic is authorized against
 * {@link BoardAccessGuard}. Without this check any authenticated user could
 * subscribe to <code>/topic/board/{id}</code> for a board they do not belong to
 * and receive every live event published for it (card titles, descriptions,
 * activity messages). Board ids are UUIDs, so the leak is reachable whenever an
 * id is shared, screenshotted or logged — even though the matching REST calls
 * correctly return 403.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final BoardAccessGuard accessGuard;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        return switch (accessor.getCommand()) {
            case CONNECT -> authenticateConnect(accessor, message);
            case SUBSCRIBE -> authorizeSubscribe(accessor, message);
            default -> message;
        };
    }

    private Message<?> authenticateConnect(StompHeaderAccessor accessor, Message<?> message) {
        // Path 1: the cookie handshake already authenticated this session.
        Authentication handshakeAuth =
                CookieHandshakeInterceptor.from(accessor.getSessionAttributes());
        if (handshakeAuth != null) {
            accessor.setUser(handshakeAuth);
            log.debug("WebSocket CONNECT authenticated from handshake cookie");
            return message;
        }

        // Path 2: an explicit bearer token on the frame.
        String authorization = accessor.getFirstNativeHeader("Authorization");
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            throw new MessagingException("Unauthenticated CONNECT: no session cookie and no bearer token");
        }
        String token = authorization.substring(BEARER_PREFIX.length());
        if (!jwtService.isTokenValid(token)) {
            throw new MessagingException("Invalid or expired JWT on CONNECT");
        }
        UserDetails userDetails = userDetailsService.loadUserByUsername(jwtService.extractUsername(token));
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
        accessor.setUser(authentication);
        log.debug("WebSocket CONNECT authenticated from bearer token for {}", userDetails.getUsername());
        return message;
    }

    /**
     * Only board members may listen to a board topic. Unparseable ids and
     * unknown destinations are rejected too, so this channel cannot be used to
     * probe the broker for reachable topics.
     */
    private Message<?> authorizeSubscribe(StompHeaderAccessor accessor, Message<?> message) {
        String destination = accessor.getDestination();
        if (destination == null || !destination.startsWith(BoardEventPublisher.BOARD_TOPIC_PREFIX)) {
            throw new MessagingException("Unsupported subscription destination");
        }
        String rawId = destination.substring(BoardEventPublisher.BOARD_TOPIC_PREFIX.length());
        UUID boardId;
        try {
            boardId = UUID.fromString(rawId);
        } catch (IllegalArgumentException ex) {
            throw new MessagingException("Malformed board id in subscription destination");
        }
        if (!(accessor.getUser() instanceof Authentication authentication)
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new MessagingException("Unauthenticated subscription");
        }
        try {
            accessGuard.assertMember(boardId, principal.getId());
        } catch (RuntimeException ex) {
            // Do not leak the reason (not-a-member vs unknown board) to the client.
            log.debug("Rejected WS subscription for board {} by {}", boardId, principal.getEmail());
            throw new MessagingException("Not authorized to subscribe to this board");
        }
        return message;
    }
}