package com.taskboard.web;

import com.taskboard.dto.auth.AuthResponse;
import com.taskboard.dto.auth.LoginRequest;
import com.taskboard.dto.auth.SignupRequest;
import com.taskboard.dto.auth.UserResponse;
import com.taskboard.security.UserPrincipal;
import com.taskboard.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Creates an account, or reports success without revealing that the address
     * was already registered. Always 201 with the same field set; see
     * {@link AuthService#signupQuiet}. A {@code null} user in the body means
     * "we cannot tell you which happened", and the client sends the person to
     * sign in rather than pretending the account was created.
     */
    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signupQuiet(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(authService.currentUser(principal));
    }
}
