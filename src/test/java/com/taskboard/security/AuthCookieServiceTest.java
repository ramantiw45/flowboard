package com.taskboard.security;

import com.taskboard.config.AuthCookieProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The cookie attributes are a security control, not a formatting detail:
 * dropping {@code HttpOnly} would put the session back within reach of any XSS,
 * which is the entire reason this design exists. These pin the attributes so a
 * well-meaning edit cannot quietly undo it.
 */
class AuthCookieServiceTest {

    private static AuthCookieService service(boolean secure, String sameSite) {
        AuthCookieProperties properties = new AuthCookieProperties(
                "taskboard.at", "taskboard.rt", secure, sameSite, 7L, "X-XSRF-TOKEN", "XSRF-TOKEN");
        return new AuthCookieService(properties);
    }

    @Nested
    @DisplayName("access token cookie")
    class AccessToken {

        @Test
        @DisplayName("is HttpOnly so JavaScript cannot read the session")
        void isHttpOnly() {
            ResponseCookie cookie = service(false, "Lax").accessToken("tok", Duration.ofHours(1));
            assertThat(cookie.isHttpOnly()).isTrue();
            assertThat(cookie.getName()).isEqualTo("taskboard.at");
        }

        @Test
        @DisplayName("is scoped to the site root so the WebSocket handshake carries it")
        void scopedToRoot() {
            // Not "/api": the socket lives at /ws-board, and a cookie scoped to
            // /api is never sent with the handshake, so CONNECT fails and the
            // client signs the user out. Found in a browser, not by reading code.
            assertThat(service(false, "Lax").accessToken("tok", Duration.ofHours(1)).getPath())
                    .isEqualTo("/");
        }

        @Test
        @DisplayName("omits Secure only when configured to")
        void secureFollowsConfiguration() {
            assertThat(service(true, "Lax").accessToken("t", Duration.ofHours(1)).isSecure()).isTrue();
            assertThat(service(false, "Lax").accessToken("t", Duration.ofHours(1)).isSecure()).isFalse();
        }

        @Test
        @DisplayName("carries the configured SameSite")
        void sameSiteFollowsConfiguration() {
            assertThat(service(false, "Lax").accessToken("t", Duration.ofHours(1)).getSameSite())
                    .isEqualTo("Lax");
            assertThat(service(false, "Strict").accessToken("t", Duration.ofHours(1)).getSameSite())
                    .isEqualTo("Strict");
        }
    }

    @Nested
    @DisplayName("refresh token cookie")
    class RefreshToken {

        @Test
        @DisplayName("is HttpOnly and equally restricted as the access cookie")
        void equallyRestricted() {
            // A refresh token outlives the access token, so protecting it less
            // would be a step backwards, not a saving.
            ResponseCookie cookie = service(false, "Lax").refreshToken("tok", Duration.ofDays(7));
            assertThat(cookie.isHttpOnly()).isTrue();
            assertThat(cookie.getPath()).isEqualTo("/");
            assertThat(cookie.getName()).isEqualTo("taskboard.rt");
        }
    }

    @Nested
    @DisplayName("clearing a cookie")
    class Clearing {

        @Test
        @DisplayName("uses Max-Age=0 with the same path and name, or it deletes nothing")
        void matchesTheOriginalCookie() {
            AuthCookieService svc = service(false, "Lax");
            ResponseCookie original = svc.accessToken("tok", Duration.ofHours(1));
            ResponseCookie cleared = svc.clearAccessToken();

            // A browser treats a Set-Cookie with a different Path as a different
            // cookie, leaving the original in place - so these must match.
            assertThat(cleared.getName()).isEqualTo(original.getName());
            assertThat(cleared.getPath()).isEqualTo(original.getPath());
            assertThat(cleared.getMaxAge()).isZero();
            assertThat(cleared.getValue()).isEmpty();
            assertThat(cleared.isHttpOnly()).isTrue();
        }

        @Test
        @DisplayName("clears the refresh cookie with its own name")
        void clearsRefreshCookie() {
            assertThat(service(false, "Lax").clearRefreshToken().getName()).isEqualTo("taskboard.rt");
        }
    }

    @Nested
    @DisplayName("refresh token hashing")
    class Hashing {

        @Test
        @DisplayName("is deterministic, so a presented token can be looked up")
        void deterministic() {
            assertThat(RefreshTokenService.hash("abc")).isEqualTo(RefreshTokenService.hash("abc"));
        }

        @Test
        @DisplayName("is 64 hex chars, matching the token_hash column")
        void matchesColumnWidth() {
            assertThat(RefreshTokenService.hash("abc")).hasSize(64).matches("[0-9a-f]{64}");
        }

        @Test
        @DisplayName("differs per token, so tokens are not interchangeable")
        void collisionResistant() {
            assertThat(RefreshTokenService.hash("a")).isNotEqualTo(RefreshTokenService.hash("b"));
        }

        @Test
        @DisplayName("does not store the raw token")
        void doesNotLeakTheRawValue() {
            String raw = "super-secret-refresh-token";
            assertThat(RefreshTokenService.hash(raw)).doesNotContain(raw);
        }
    }
}