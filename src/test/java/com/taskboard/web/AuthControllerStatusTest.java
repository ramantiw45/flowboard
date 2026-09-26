package com.taskboard.web;

import com.taskboard.dto.auth.AuthResponse;
import com.taskboard.dto.auth.LoginRequest;
import com.taskboard.dto.auth.SignupRequest;
import com.taskboard.dto.auth.UserResponse;
import com.taskboard.security.AuthCookieService;
import com.taskboard.service.AuthService;
import com.taskboard.user.User;
import com.taskboard.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * The cookie work rewrote how auth responses are built, and a plain
 * {@code ResponseEntity.ok()} slipped into the sign-up path during that rewrite.
 *
 * <p>That is worth a test rather than a code review: sign-up answering 201 for a
 * duplicate address and 200 for a fresh one would reopen the account-enumeration
 * oracle that {@code AuthServiceSignupTest} closed, and the status code is the
 * only thing distinguishing the two responses.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthControllerStatusTest {

    private static final String EMAIL = "someone@example.com";
    private static final String TOKEN = "a.jwt.token";

    @Mock
    private AuthService authService;

    @Mock
    private AuthCookieService authCookieService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private com.taskboard.config.AuthCookieProperties authCookieProperties;

    @InjectMocks
    private AuthController controller;

    private UserResponse user() {
        return new UserResponse(UUID.randomUUID(), EMAIL, "Someone", null);
    }

    private User entity() {
        User user = User.builder().email(EMAIL).displayName("Someone").passwordHash("h").build();
        user.setId(UUID.randomUUID());
        return user;
    }

    private void cookiesAvailable() {
        when(authCookieService.accessToken(anyString(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(org.springframework.http.ResponseCookie.from("taskboard.at", TOKEN)
                        .httpOnly(true).path("/api").build());
        when(authCookieService.refreshToken(anyString(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(org.springframework.http.ResponseCookie.from("taskboard.rt", "refresh")
                        .httpOnly(true).path("/api").build());
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(entity()));
        when(authService.issueRefreshToken(org.mockito.ArgumentMatchers.any()))
                .thenReturn("a-refresh-token");
    }

    @Test
    @DisplayName("a fresh sign-up answers 201 and sets both cookies")
    void freshSignupIs201WithCookies() {
        cookiesAvailable();
        when(authService.signupQuiet(org.mockito.ArgumentMatchers.any(SignupRequest.class)))
                .thenReturn(AuthResponse.bearer(TOKEN, user()));

        ResponseEntity<AuthResponse> response =
                controller.signup(new SignupRequest(EMAIL, "Someone", "Passw0rd!23"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().get("Set-Cookie")).hasSize(2);
    }

    @Test
    @DisplayName("a duplicate sign-up also answers 201, with no cookies")
    void duplicateSignupIsAlso201() {
        when(authService.signupQuiet(org.mockito.ArgumentMatchers.any(SignupRequest.class)))
                .thenReturn(new AuthResponse(null, "Bearer", null));

        ResponseEntity<AuthResponse> response =
                controller.signup(new SignupRequest(EMAIL, "Someone", "Passw0rd!23"));

        // Same status as the success path, so the code cannot be used to tell
        // which addresses are registered.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        // And no session: a working cookie here would let anyone claim the
        // existing account.
        assertThat(response.getHeaders().get("Set-Cookie")).isNull();
        assertThat(response.getBody().user()).isNull();
    }

    @Test
    @DisplayName("sign-in answers 200 and sets both cookies")
    void loginIs200WithCookies() {
        cookiesAvailable();
        when(authService.login(org.mockito.ArgumentMatchers.any(LoginRequest.class)))
                .thenReturn(AuthResponse.bearer(TOKEN, user()));

        ResponseEntity<AuthResponse> response =
                controller.login(new LoginRequest(EMAIL, "Passw0rd!23"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().get("Set-Cookie")).hasSize(2);
    }
}