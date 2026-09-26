package com.taskboard.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Populates the SecurityContext from a JWT, and is deliberately the only place
 * that decides where a token may come from.
 *
 * <p>Two sources are accepted, in this order:
 * <ol>
 *   <li>the {@code HttpOnly} auth cookie - what the browser sends;</li>
 *   <li>{@code Authorization: Bearer} - kept for non-browser clients and for
 *       the STOMP {@code CONNECT} frame, which has no cookie of its own.</li>
 * </ol>
 *
 * <p>The header is not removed deliberately: the STOMP handshake is a separate
 * HTTP request from the {@code fetch} calls, and {@code tools/wsauthcheck.mjs}
 * still drives the socket with a bearer token. Removing it would also remove the
 * ability to authenticate a non-browser API client at all.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;
    private final AuthCookieService authCookieService;

    /**
     * The holder strategy, so a context created here is one the framework's
     * own filters will recognise and not treat as a different context.
     */
    private final SecurityContextHolderStrategy securityContextHolderStrategy =
            SecurityContextHolder.getContextHolderStrategy();

    /**
     * The token for this request, or null when the caller presented none.
     * Cookie first: that is what a browser sends, and it is the only source an
     * XSS payload cannot forge.
     */
    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length());
        }
        return authCookieService.readAccessToken(request);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null && !token.isBlank()
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            if (jwtService.isTokenValid(token)) {
                String email = jwtService.extractUsername(token);
                UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                // A fresh context, set via the holder strategy. Mutating the
                // existing (empty) context in place is not equivalent: the
                // framework's own filters compare contexts by identity, and
                // AnonymousAuthenticationFilter would treat an in-place edit as
                // "nothing set yet" and overwrite it with an anonymous token.
                SecurityContext context = securityContextHolderStrategy.createEmptyContext();
                context.setAuthentication(authentication);
                securityContextHolderStrategy.setContext(context);
            } else {
                // An expired cookie must not wedge the user: the client calls
                // /auth/refresh, which sets a new one. Logged at debug because a
                // stale cookie is normal, not an attack.
                log.debug("Rejected invalid JWT for {}", request.getRequestURI());
            }
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            // Never leak one request's identity into the next on a pooled thread.
            securityContextHolderStrategy.clearContext();
        }
    }
}
