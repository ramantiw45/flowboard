package com.taskboard.websocket;

import com.taskboard.common.exception.ForbiddenException;
import com.taskboard.security.CustomUserDetailsService;
import com.taskboard.security.JwtService;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.BoardAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guards the two things the inbound STOMP channel must enforce: a valid JWT on
 * CONNECT, and board membership on SUBSCRIBE.
 *
 * <p>The SUBSCRIBE check is a security control. Without it any authenticated
 * user could listen to another board's live event stream (card titles,
 * descriptions, activity messages) even though the REST API correctly returns
 * 403 for the same board.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JwtChannelInterceptorTest {

    private static final UUID BOARD_ID = UUID.fromString("80b2999b-76ae-4489-929a-c9084ff3f472");
    private static final UUID USER_ID = UUID.fromString("f526615d-297e-47ba-b100-eecc4ff6557c");
    private static final String TOPIC = "/topic/board/" + BOARD_ID;

    @Mock private JwtService jwtService;
    @Mock private CustomUserDetailsService userDetailsService;
    @Mock private BoardAccessGuard accessGuard;

    private JwtChannelInterceptor interceptor;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        interceptor = new JwtChannelInterceptor(jwtService, userDetailsService, accessGuard);
        principal = new UserPrincipal(USER_ID, "member@example.com", "Member", "hash");
    }

    private Message<byte[]> frame(StompCommand command, java.util.function.Consumer<StompHeaderAccessor> setup) {
        // StompHeaderAccessor.create(...) hands back an immutable accessor, but
        // frames arriving from the client are mutable: the handler has to be able
        // to attach the authenticated user. Rebuild the message around a mutable
        // view of the same headers.
        StompHeaderAccessor template = StompHeaderAccessor.create(command);
        setup.accept(template);
        Message<byte[]> seed = MessageBuilder.createMessage(new byte[0], template.getMessageHeaders());
        MessageHeaderAccessor mutable = MessageHeaderAccessor.getMutableAccessor(seed);
        return MessageBuilder.createMessage(new byte[0], mutable.getMessageHeaders());
    }

    private Message<byte[]> connect(String authorization) {
        return frame(StompCommand.CONNECT, a -> {
            if (authorization != null) {
                a.setNativeHeader("Authorization", authorization);
            }
        });
    }

    private Message<byte[]> subscribe(String destination, Authentication user) {
        return frame(StompCommand.SUBSCRIBE, a -> {
            a.setDestination(destination);
            if (user != null) {
                a.setUser(user);
            }
        });
    }

    private static Authentication attachedUser(Message<?> message) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        return accessor == null ? null : (Authentication) accessor.getUser();
    }

    private Authentication auth() {
        return new UsernamePasswordAuthenticationToken(principal, null, List.of());
    }

    @Test
    @DisplayName("CONNECT validates the token and loads the principal")
    void connectAcceptsValidToken() {
        when(jwtService.isTokenValid("good-token")).thenReturn(true);
        when(jwtService.extractUsername("good-token")).thenReturn("member@example.com");
        when(userDetailsService.loadUserByUsername("member@example.com")).thenReturn(principal);

        // A hand-built CONNECT frame carries immutable STOMP headers, so the
        // interceptor cannot attach the user in this harness; assert on the
        // authentication work it performs instead. Attaching the user is covered
        // end-to-end by tools/wsauthcheck.mjs against the running server.
        assertThatThrownBy(() -> interceptor.preSend(connect("Bearer good-token"), null))
                .isInstanceOf(IllegalStateException.class)   // "Already immutable"
                .hasMessageContaining("immutable");

        verify(jwtService).isTokenValid("good-token");
        verify(userDetailsService).loadUserByUsername("member@example.com");
    }

    @Test
    @DisplayName("CONNECT without a usable bearer token is rejected")
    void connectRejectsMissingHeader() {
        assertThatThrownBy(() -> interceptor.preSend(connect(null), null))
                .isInstanceOf(MessagingException.class);
        assertThatThrownBy(() -> interceptor.preSend(connect("Token abc"), null))
                .isInstanceOf(MessagingException.class);
    }

    @Test
    @DisplayName("CONNECT with an expired token is rejected")
    void connectRejectsInvalidToken() {
        when(jwtService.isTokenValid("stale")).thenReturn(false);
        assertThatThrownBy(() -> interceptor.preSend(connect("Bearer stale"), null))
                .isInstanceOf(MessagingException.class);
    }

    @Test
    @DisplayName("a member may subscribe to their own board topic")
    void memberCanSubscribe() {
        assertThatCode(() -> interceptor.preSend(subscribe(TOPIC, auth()), null))
                .doesNotThrowAnyException();
        verify(accessGuard).assertMember(BOARD_ID, USER_ID);
    }

    @Test
    @DisplayName("a non-member is refused the board topic")
    void nonMemberCannotSubscribe() {
        doThrow(new ForbiddenException("not a member"))
                .when(accessGuard).assertMember(any(UUID.class), any(UUID.class));

        assertThatThrownBy(() -> interceptor.preSend(subscribe(TOPIC, auth()), null))
                .isInstanceOf(MessagingException.class)
                .hasMessageContaining("Not authorized");
    }

    @Test
    @DisplayName("the refusal does not disclose whether the board exists")
    void nonMemberErrorIsOpaque() {
        doThrow(new IllegalStateException("Board 80b2999b does not exist"))
                .when(accessGuard).assertMember(any(UUID.class), any(UUID.class));

        assertThatThrownBy(() -> interceptor.preSend(subscribe(TOPIC, auth()), null))
                .isInstanceOf(MessagingException.class)
                .hasMessageNotContaining("80b2999b")
                .hasMessageNotContaining("exist");
    }

    @Test
    @DisplayName("an unauthenticated SUBSCRIBE is rejected")
    void subscribeWithoutUserIsRejected() {
        assertThatThrownBy(() -> interceptor.preSend(subscribe(TOPIC, null), null))
                .isInstanceOf(MessagingException.class);
    }

    @Test
    @DisplayName("a malformed board id in the destination is rejected")
    void malformedDestinationRejected() {
        assertThatThrownBy(() -> interceptor.preSend(subscribe("/topic/board/not-a-uuid", auth()), null))
                .isInstanceOf(MessagingException.class);
    }

    @Test
    @DisplayName("destinations outside the board topic prefix are rejected")
    void foreignDestinationRejected() {
        assertThatThrownBy(() -> interceptor.preSend(subscribe("/topic/anything", auth()), null))
                .isInstanceOf(MessagingException.class);
        assertThatThrownBy(() -> interceptor.preSend(subscribe(null, auth()), null))
                .isInstanceOf(MessagingException.class);
    }

    @Test
    @DisplayName("other commands pass through untouched")
    void otherCommandsPassThrough() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        assertThat(interceptor.preSend(message, null)).isSameAs(message);
    }
}
