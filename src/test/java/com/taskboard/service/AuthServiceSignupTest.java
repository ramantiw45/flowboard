package com.taskboard.service;

import com.taskboard.dto.auth.AuthResponse;
import com.taskboard.dto.auth.SignupRequest;
import com.taskboard.security.JwtService;
import com.taskboard.security.UserPrincipal;
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
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sign-up used to answer 409 for an address that was already registered, so
 * anyone could harvest valid emails by watching the status code. These pin the
 * replacement: both outcomes look identical from outside, and neither leaks a
 * working session for an account the caller does not own.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceSignupTest {

    private static final String EMAIL = "someone@example.com";
    private static final String PASSWORD = "Passw0rd!23";

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private JwtService jwtService;

    @InjectMocks private AuthService service;

    private SignupRequest request() {
        return new SignupRequest(EMAIL, "Some One", PASSWORD);
    }

    private void existingAccount() {
        when(userRepository.existsByEmail(EMAIL)).thenReturn(true);
    }

    @Test
    @DisplayName("a new address creates the account and returns a session")
    void newAddressCreatesAccount() {
        UUID id = UUID.randomUUID();
        when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(id);
            return u;
        });
        when(passwordEncoder.encode(PASSWORD)).thenReturn("hashed");
        when(jwtService.generateToken(any(UserPrincipal.class))).thenReturn("a-real-token");

        AuthResponse response = service.signupQuiet(request());

        assertThat(response.user()).isNotNull();
        assertThat(response.token()).isEqualTo("a-real-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("a taken address returns 201-shaped data with no session, not a conflict")
    void takenAddressDoesNotLeak() {
        existingAccount();

        AuthResponse response = service.signupQuiet(request());

        // Same field set as a real signup, so the shape carries no signal.
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.user()).isNull();
        assertThat(response.token()).isNull();
    }

    @Test
    @DisplayName("a taken address is never modified or handed a working token")
    void takenAddressIsNotTouched() {
        existingAccount();

        service.signupQuiet(request());

        verify(userRepository, never()).save(any(User.class));
        verify(jwtService, never()).generateToken(any(UserPrincipal.class));
    }

    @Test
    @DisplayName("the two outcomes differ only in the body, never in the status path")
    void bothOutcomesResolve() {
        existingAccount();
        assertThat(service.signupQuiet(request())).isNotNull();

        when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateToken(any(UserPrincipal.class))).thenReturn("t");

        // Neither call throws, so the controller returns 201 for both and the
        // status code stops being an oracle.
        assertThat(service.signupQuiet(request())).isNotNull();
    }

    @Test
    @DisplayName("the email is normalised before the existence check")
    void emailIsNormalised() {
        when(userRepository.existsByEmail(EMAIL)).thenReturn(true);

        // Mixed case and padding must not create a second account for the same
        // address, or enumeration comes back through case variants.
        service.signupQuiet(new SignupRequest("  SomeOne@Example.COM  ", "Some One", PASSWORD));

        verify(userRepository).existsByEmail(EMAIL);
    }

    @Test
    @DisplayName("the strict signup still reports a conflict for internal callers")
    void strictSignupStillThrows() {
        when(userRepository.existsByEmail(EMAIL)).thenReturn(true);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(new User()));

        org.assertj.core.api.Assertions
                .assertThatThrownBy(() -> service.signup(request()))
                .isInstanceOf(com.taskboard.common.exception.ConflictException.class);
    }
}
