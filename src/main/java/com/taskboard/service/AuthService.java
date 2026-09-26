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
