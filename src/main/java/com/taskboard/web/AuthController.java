package com.taskboard.web;

import com.taskboard.config.AuthCookieProperties;
import com.taskboard.dto.auth.AuthResponse;
import com.taskboard.dto.auth.LoginRequest;
import com.taskboard.dto.auth.SignupRequest;
import com.taskboard.dto.auth.UserResponse;
import com.taskboard.security.AuthCookieService;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.AuthService;
import com.taskboard.user.User;
import com.taskboard.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    /**
     * The access token's own lifetime. It matches the JWT expiry, so a cookie
     * never outlives the token it carries - otherwise the browser would keep
     * presenting a dead token and the user would be logged out by the clock
     * rather than by the refresh flow.
     */
    private static final Duration ACCESS_COOKIE_TTL = Duration.ofHours(1);

    private final AuthService authService;
    private final AuthCookieService authCookieService;
    private final UserRepository userRepository;
    private final AuthCookieProperties authCookieProperties;

    /**
     * Creates an account, or reports success without revealing that the address
     * was already registered. Always 201 with the same field set; see
     * {@link AuthService#signupQuiet}. A {@code null} user in the body means
     * "we cannot tell you which happened", and the client sends the person to
     * sign in rather than pretending the account was created.
     *
     * <p>No session cookie is set when the address was already taken: handing
     * back a working session would let anyone claim an existing account.
     */
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        AuthResponse auth = authService.signupQuiet(request);
        if (auth.user() == null) {
            return ResponseEntity.status(HttpStatus.CREATED).body(auth);
        }
        // 201 even on the success path: the two outcomes must be
        // indistinguishable, so this cannot answer 200 while the duplicate case
        // answers 201.
        return withSessionCookies(auth, auth.user().email(), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse auth = authService.login(request);
        return withSessionCookies(auth, auth.user().email(), HttpStatus.OK);
    }

    /**
     * Exchanges the refresh cookie for a fresh access token.
     *
     * <p>Answers 401 when there is no usable refresh token, which is what the
     * client uses to decide it must send the person back to the sign-in screen.
     */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request) {
        String refreshToken = authCookieService.readRefreshToken(request);
        Optional<AuthResponse> refreshed = authService.refresh(refreshToken);
        if (refreshed.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .header(HttpHeaders.SET_COOKIE, authCookieService.clearRefreshToken().toString())
                    .build();
        }
        return withSessionCookies(refreshed.get(), refreshed.get().user().email(), HttpStatus.OK);
    }

    /**
     * Signs out, server-side.
     *
     * <p>This is a real revocation: the refresh token is marked spent in the
     * database, so a copy of it cannot be used to mint a new access token even
     * though the raw value was never stored. The cookies are cleared regardless
     * of whether a valid token was presented, so a client holding a stale cookie
     * still ends up clean. Always 204, and deliberately idempotent.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(authCookieService.readRefreshToken(request));
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, authCookieService.clearAccessToken().toString())
                .header(HttpHeaders.SET_COOKIE, authCookieService.clearRefreshToken().toString())
                .build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authService.currentUser(principal));
    }

    /**
     * Attaches the access and refresh cookies to a successful auth response.
     *
     * <p>The user is re-read by email because {@code AuthResponse} carries only a
     * DTO, and the refresh token has to be bound to a managed {@link User}.
     *
     * <p>The two cookies get deliberately different lifetimes: the access cookie
     * is short so a stolen one dies quickly, while the refresh cookie lives as
     * long as the refresh token it stands for. Giving them one shared lifetime
     * would either expire the refresh cookie early (logging people out) or keep
     * the access cookie alive long past its JWT.
     */
    private ResponseEntity<AuthResponse> withSessionCookies(AuthResponse auth, String email, HttpStatus status) {
        String refreshToken = userRepository.findByEmail(email)
                .map(authService::issueRefreshToken)
                .orElse(null);
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status);
        builder.header(HttpHeaders.SET_COOKIE,
                authCookieService.accessToken(auth.token(), ACCESS_COOKIE_TTL).toString());
        if (refreshToken != null) {
            builder.header(HttpHeaders.SET_COOKIE,
                    authCookieService.refreshToken(refreshToken,
                            Duration.ofMillis(authCookieProperties.refreshTtlMillis())).toString());
        }
        return builder.body(auth);
    }
}
