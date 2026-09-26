package com.taskboard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed configuration for JWT settings (see app.jwt in application.yml).
 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, long expirationMs, String issuer) {
}
