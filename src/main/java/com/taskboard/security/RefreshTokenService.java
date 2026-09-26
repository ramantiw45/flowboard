package com.taskboard.security;

import com.taskboard.config.AuthCookieProperties;
import com.taskboard.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Issues, verifies and revokes refresh tokens.
 *
 * <p>Design: the token is an opaque 256-bit random string, not a JWT. That is
 * the whole point of having the table - a refresh token that is a self-contained
 * signed blob cannot be revoked, so "sign out" would leave a working credential
 * on disk until it expired. Only the SHA-256 of the token is stored, so a copy
 * of the database is not a copy of everyone's sessions.
 *
 * <p>Rotation: every refresh issues a new token and revokes the presented one.
 * If a revoked token is presented again, it was replayed (it was stolen and both
 * copies are in use), so every token for that user is revoked. The legitimate
 * client is logged out too, which is the safe failure: attacker and victim both
 * re-authenticate rather than the attacker keeping access.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    /** 32 bytes = 256 bits, the usual size for an opaque bearer credential. */
    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository repository;
    private final AuthCookieProperties properties;

    private final SecureRandom random = new SecureRandom();

    /**
     * Hashing rather than storing the raw value. SHA-256 is the right primitive
     * here (not bcrypt/argon2) because the input is 256 bits of CSPRNG output, so
     * there is no dictionary to attack; the hash exists to make a database dump
     * useless, not to slow down guessing.
     */
    static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the JDK spec", e);
        }
    }

    /** A fresh opaque token. Only the caller ever sees this value. */
    public String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Issues a token for {@code user} and returns the raw value. The caller puts
     * it in a cookie and then forgets it.
     */
    @Transactional
    public String issue(User user) {
        String raw = newToken();
        repository.save(RefreshToken.builder()
                .user(user)
                .tokenHash(hash(raw))
                .expiresAt(Instant.now().plusMillis(properties.refreshTtlMillis()))
                .build());
        return raw;
    }

    /**
     * Consumes a refresh token, returning the user it belongs to.
     *
     * <p>An absent, unknown, expired or already-revoked token is reported the
     * same way ({@link Optional#empty()}) so the endpoint cannot be used to test
     * whether a guessed token ever existed.
     */
    @Transactional
    public Optional<User> consume(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        Optional<RefreshToken> found = repository.findByTokenHash(hash(rawToken));
        if (found.isEmpty()) {
            return Optional.empty();
        }
        RefreshToken token = found.get();
        if (!token.isUsableAt(Instant.now())) {
            if (token.getRevokedAt() != null && token.getUser() != null) {
                log.warn("Replayed refresh token for user {} - revoking all of their sessions",
                        token.getUser().getEmail());
                revokeAll(token.getUser());
            }
            return Optional.empty();
        }
        // Rotate: the presented token is spent, the caller gets a new one.
        token.setRevokedAt(Instant.now());
        repository.save(token);
        return Optional.of(token.getUser());
    }

    /** Revokes the token backing a sign-out, if it is still known. */
    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repository.findByTokenHash(hash(rawToken))
                .filter(token -> token.getRevokedAt() == null)
                .ifPresent(token -> {
                    token.setRevokedAt(Instant.now());
                    repository.save(token);
                });
    }

    @Transactional
    public void revokeAll(User user) {
        Instant now = Instant.now();
        for (RefreshToken token : repository.findAll()) {
            if (token.getUser() != null
                    && token.getUser().getId().equals(user.getId())
                    && token.getRevokedAt() == null) {
                token.setRevokedAt(now);
                repository.save(token);
            }
        }
    }

    /**
     * Drops rows that expired more than a day ago.
     *
     * <p>The grace period exists so an audit can still see that a session was
     * live shortly before it lapsed; deleting the row the instant it expires
     * would erase the only evidence that it existed.
     */
    @Scheduled(cron = "0 17 4 * * *")
    @Transactional
    public void purgeExpired() {
        long removed = repository.deleteByExpiresAtBefore(Instant.now().minusSeconds(86_400));
        if (removed > 0) {
            log.info("Purged {} expired refresh token(s)", removed);
        }
    }
}