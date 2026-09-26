package com.taskboard.security;

import com.taskboard.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

/**
 * JWT issuing / parsing using JJWT 0.12.x (HMAC-SHA256).
 * Subject = user email; "uid" claim carries the UUID.
 */
@Service
@RequiredArgsConstructor
public class JwtService {

    public static final String CLAIM_UID = "uid";

    private final JwtProperties properties;

    private SecretKey signingKey() {
        return Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(UserPrincipal principal) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(principal.getEmail())
                .claim(CLAIM_UID, principal.getId().toString())
                .issuer(properties.issuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(properties.expirationMs())))
                .signWith(signingKey())
                .compact();
    }

    /**
     * Parses and validates signature + expiration + issuer.
     *
     * @return the subject (user email)
     * @throws JwtException if the token is invalid or expired
     */
    public String extractUsername(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey())
                .requireIssuer(properties.issuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.getSubject();
    }

    public boolean isTokenValid(String token) {
        try {
            extractUsername(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
