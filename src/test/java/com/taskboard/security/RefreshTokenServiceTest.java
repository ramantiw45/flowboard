package com.taskboard.security;

import com.taskboard.config.AuthCookieProperties;
import com.taskboard.user.User;
import com.taskboard.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Refresh tokens are what make "sign out" real. These pin the two properties
 * that matter: a token is single-use (rotation), and a replayed one burns the
 * whole session rather than quietly working.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RefreshTokenServiceTest {

    private static final String EMAIL = "someone@example.com";

    @Mock
    private RefreshTokenRepository repository;

    @Mock
    private UserRepository userRepository;

    private RefreshTokenService service;

    private User user;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(
                repository,
                new AuthCookieProperties("taskboard.at", "taskboard.rt", false, "Lax", 7L,
                        "X-XSRF-TOKEN", "XSRF-TOKEN"));
        user = User.builder().email(EMAIL)
                .displayName("Someone").passwordHash("hash").build();
        // `id` lives on the BaseEntity superclass, which @Builder does not cover.
        user.setId(UUID.randomUUID());
    }

    /** A stored, live token for {@link #user}. */
    private RefreshToken liveToken() {
        RefreshToken token = RefreshToken.builder()
                .user(user)
                .tokenHash(RefreshTokenService.hash("raw-token"))
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        token.setId(UUID.randomUUID());
        return token;
    }

    @Test
    @DisplayName("issues a distinct token each time")
    void issuesDistinctTokens() {
        assertThat(service.newToken()).isNotEqualTo(service.newToken());
    }

    @Test
    @DisplayName("never stores the raw token, only its hash")
    void storesOnlyTheHash() {
        when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
        String raw = service.issue(user);

        var captor = org.mockito.ArgumentCaptor.forClass(RefreshToken.class);
        org.mockito.Mockito.verify(repository).save(captor.capture());
        assertThat(captor.getValue().getTokenHash()).isEqualTo(RefreshTokenService.hash(raw));
        assertThat(captor.getValue().getTokenHash()).isNotEqualTo(raw);
    }

    @Test
    @DisplayName("consuming a live token returns its user and spends the token")
    void consumeSpendsTheToken() {
        RefreshToken stored = liveToken();
        when(repository.findByTokenHash(RefreshTokenService.hash("raw-token")))
                .thenReturn(Optional.of(stored));

        Optional<User> result = service.consume("raw-token");

        assertThat(result).contains(user);
        // Rotation: the presented token is now spent, so it cannot be reused.
        assertThat(stored.getRevokedAt()).isNotNull();
    }

    @Test
    @DisplayName("a spent token cannot be used a second time")
    void spentTokenIsRejected() {
        RefreshToken stored = liveToken();
        stored.setRevokedAt(Instant.now());
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        assertThat(service.consume("raw-token")).isEmpty();
    }

    @Test
    @DisplayName("an expired token is rejected")
    void expiredTokenIsRejected() {
        RefreshToken stored = liveToken();
        stored.setExpiresAt(Instant.now().minusSeconds(60));
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        assertThat(service.consume("raw-token")).isEmpty();
    }

    @Test
    @DisplayName("an unknown token is rejected without saying so differently")
    void unknownTokenIsRejected() {
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.empty());
        assertThat(service.consume("never-existed")).isEmpty();
    }

    @Test
    @DisplayName("a blank or null token is rejected without a database hit")
    void blankTokenIsRejected() {
        assertThat(service.consume(null)).isEmpty();
        assertThat(service.consume("  ")).isEmpty();
        org.mockito.Mockito.verify(repository, org.mockito.Mockito.never())
                .findByTokenHash(anyString());
    }

    @Test
    @DisplayName("logout revokes the presented token")
    void logoutRevokes() {
        RefreshToken stored = liveToken();
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        service.revoke("raw-token");

        assertThat(stored.getRevokedAt()).isNotNull();
    }

    @Test
    @DisplayName("logout is idempotent and tolerates an unknown token")
    void logoutIsSafe() {
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.empty());
        service.revoke("nope");
        service.revoke(null);
    }
}