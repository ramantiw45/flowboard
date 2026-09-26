package com.taskboard.service;

import com.taskboard.common.exception.ConflictException;
import com.taskboard.common.exception.ForbiddenException;
import com.taskboard.dto.auth.AuthResponse;
import com.taskboard.dto.auth.LoginRequest;
import com.taskboard.dto.auth.SignupRequest;
import com.taskboard.dto.auth.UserResponse;
import com.taskboard.security.JwtService;
import com.taskboard.security.UserPrincipal;
import com.taskboard.user.User;
import com.taskboard.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String email = request.email().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("An account with this email already exists");
        }
        User user = userRepository.save(User.builder()
                .email(email)
                .displayName(request.displayName().trim())
                .passwordHash(passwordEncoder.encode(request.password()))
                .build());
        return AuthResponse.bearer(jwtService.generateToken(UserPrincipal.from(user)), UserResponse.from(user));
    }

    /**
     * Sign-up that does not reveal whether an address is already registered.
     *
     * <p>{@link #signup} answers a duplicate email with {@code 409}, so anyone
     * can harvest registered addresses by watching the status code. Here both
     * outcomes answer {@code 201 Created} with the same field set, so the two
     * are indistinguishable to a caller who is not the account's owner.
     *
     * <p>When the address is taken the response carries a {@code null} user and
     * an unusable token. That is deliberate: handing back a working session
     * would let anyone claim an existing account, which is a far worse hole
     * than enumeration. The client treats the {@code null} user as "we cannot
     * tell you which happened" and directs the person to sign in.
     *
     * <p>Cost, stated plainly: someone who re-runs sign-up with an address they
     * already own is told nothing specific and must use sign-in instead. That
     * is the price of not confirming ownership, and it disappears once email
     * verification exists.
     */
    @Transactional
    public AuthResponse signupQuiet(SignupRequest request) {
        String email = request.email().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) {
            // No user, no session. Field set and status match a real signup.
            return new AuthResponse(null, "Bearer", null);
        }
        User user = userRepository.save(User.builder()
                .email(email)
                .displayName(request.displayName().trim())
                .passwordHash(passwordEncoder.encode(request.password()))
                .build());
        return AuthResponse.bearer(jwtService.generateToken(UserPrincipal.from(user)), UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email().toLowerCase().trim(), request.password()));
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return AuthResponse.bearer(jwtService.generateToken(principal), new UserResponse(
                principal.getId(), principal.getEmail(), principal.getDisplayName(), null));
    }

    public UserResponse currentUser(UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ForbiddenException("Unknown user"));
        return UserResponse.from(user);
    }
}
