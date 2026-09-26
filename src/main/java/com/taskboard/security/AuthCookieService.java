package com.taskboard.security;

import com.taskboard.config.AuthCookieProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.time.Instant;

/**
 * Builds and reads the auth cookies, so the attribute decisions
 * ({@code HttpOnly}, {@code Secure}, {@code SameSite}, {@code Path}, {@code Max-Age})
 * live in exactly one place.
 *
 * <p>Why cookies instead of {@code localStorage}: a token in {@code localStorage}
 * is readable by any script on the page, so one XSS exfiltrates a long-lived
 * credential that keeps working after the tab closes. An {@code HttpOnly} cookie
 * is not reachable from JavaScript at all, which turns token theft via XSS into
 * token theft via the network instead - and {@code Secure} plus {@code SameSite}
 * close most of that.
 *
 * <p>The cost of moving the credential into a cookie is that the browser now
 * attaches it automatically, which is precisely what makes CSRF possible. That
 * is why {@code app.auth.cookie-name} lives next to the CSRF configuration:
 * see {@code SecurityConfig} for how the two are balanced.
 */
@Component
@RequiredArgsConstructor
public class AuthCookieService {

    /**
     * The cookies are scoped to {@code /} rather than {@code /api}.
     *
     * <p>Narrowing to {@code /api} looks tidier - it keeps the credential off
     * static-asset requests - but it silently breaks real-time updates. The
     * WebSocket endpoint is {@code /ws-board}, not under {@code /api}, so a
     * cookie scoped to {@code /api} is never sent with the SockJS handshake.
     * {@code CookieHandshakeInterceptor} then finds no session, the STOMP
     * CONNECT is rejected, and the client responds by signing the user out.
     *
     * <p>Found by driving the app in a browser rather than by reading the code:
     * sign-in succeeded, {@code GET /api/auth/me} answered 200, and the app
     * still bounced to the login screen a moment later.
     *
     * <p>The broader path costs little: a same-origin static asset request
     * carries the cookie but ignores it, and the value is unreadable from
     * script either way because it is {@code HttpOnly}.
     */
    public static final String COOKIE_PATH = "/";

    private final AuthCookieProperties properties;

    /** {@code Set-Cookie} for a freshly issued access token. */
    public ResponseCookie accessToken(String token, Duration maxAge) {
        return base(properties.cookieName(), token, maxAge);
    }

    /**
     * {@code Set-Cookie} for a refresh token. Same attributes as the access
     * cookie: it is equally sensitive, and a refresh token outlives the access
     * token, so protecting it less would be a step backwards.
     */
    public ResponseCookie refreshToken(String token, Duration maxAge) {
        return base(properties.refreshCookieName(), token, maxAge);
    }

    /**
     * A cookie that deletes an auth cookie. The attributes must match the ones
     * used when it was set (notably {@code Path}), or the browser treats it as a
     * different cookie and leaves the original in place.
     */
    public ResponseCookie clearAccessToken() {
        return base(properties.cookieName(), "", Duration.ZERO);
    }

    public ResponseCookie clearRefreshToken() {
        return base(properties.refreshCookieName(), "", Duration.ZERO);
    }

    private ResponseCookie base(String name, String value, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(properties.secure())
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                // SameSite=Lax still sends the cookie on top-level GET navigations
                // (so a shared link to a board works) but not on cross-site POSTs,
                // which is what blocks the common CSRF shapes. Strict would be
                // stronger but breaks any legitimate cross-site navigation into
                // the app; Lax is the deliberate trade-off.
                .sameSite(properties.sameSite())
                .build();
    }

    /** The access token from the request cookie, or null when absent. */
    public String readAccessToken(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, properties.cookieName());
        return cookie == null ? null : cookie.getValue();
    }

    /** The refresh token from the request cookie, or null when absent. */
    public String readRefreshToken(HttpServletRequest request) {
        Cookie cookie = WebUtils.getCookie(request, properties.refreshCookieName());
        return cookie == null ? null : cookie.getValue();
    }

    /** Convenience for building a {@code Duration} from an instant. */
    public static Duration until(Instant instant) {
        Duration d = Duration.between(Instant.now(), instant);
        return d.isNegative() ? Duration.ZERO : d;
    }

    /** Header name for the CSRF token, so the filter and client agree. */
    public String csrfHeaderName() {
        return properties.csrfHeaderName();
    }

    public String csrfCookieName() {
        return properties.csrfCookieName();
    }
}