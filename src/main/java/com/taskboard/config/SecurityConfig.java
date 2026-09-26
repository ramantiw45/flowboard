package com.taskboard.config;

import com.taskboard.security.CustomUserDetailsService;
import com.taskboard.security.JwtAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CustomUserDetailsService userDetailsService;
    private final SecurityHeadersFilter securityHeadersFilter;

    /**
     * Writes the CSRF cookie. Configured as the chain's request handler rather
     * than added as a filter, because it has to run inside CsrfFilter - which is
     * what resolves the deferred token in the first place.
     */
    private final CsrfCookieFilter csrfCookieFilter;

    /**
     * The CSRF token store.
     *
     * <p>Declared as a bean because {@code CsrfConfigurer} builds its repository
     * internally and does not publish it, and {@link CsrfCookieFilter} must write
     * through the very same instance - otherwise the cookie the client echoes
     * back would be compared against an unrelated token.
     *
     * <p>Not HttpOnly: the double-submit pattern requires the client to read this
     * cookie and echo it in a header. The session cookie remains HttpOnly.
     */
    private final CookieCsrfTokenRepository csrfTokenRepository;

    @Value("${cors.allowed-origins}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CSRF is re-enabled deliberately, because the session now lives
                // in a cookie. A bearer token in a header is not attached by the
                // browser automatically, so it cannot be abused cross-site; a
                // cookie is, which is exactly what CSRF is for. Leaving this
                // disabled would have been a real regression disguised as a
                // refactor, so the trade-off is spelled out here instead:
                //
                //  - The tokens are held in a cookie (XSRF-TOKEN, readable by JS
                //    on purpose) and echoed in the X-XSRF-TOKEN header, which is
                //    the axios default pair. The auth cookie itself stays
                //    HttpOnly, so this does not give XSS the session.
                //  - SameSite=Lax on the session cookie is the first line of
                //    defence; the token is the second, for the cases Lax misses
                //    (older browsers, same-site subdomains).
                //  - This does change the CORS story: the header makes requests
                //    non-simple, so every cross-origin call now triggers a
                //    preflight. CORS already allows the origin and the header
                //    (allowedHeaders "*"), and the SockJS endpoint is exempt
                //    because STOMP has its own CONNECT-time authentication.
                .csrf(csrf -> csrf
                        // The same instance CsrfCookieFilter writes with, so the
                        // cookie the client is given is the token that is checked.
                        .csrfTokenRepository(csrfTokenRepository)
                        // Spring Security defers CSRF token creation, so the
                        // XSRF-TOKEN cookie is only written when a request needs a
                        // token - which for a JSON API means only when one is
                        // *missing*, i.e. on the 403 after a failed write. The
                        // client could then never obtain a valid token to send and
                        // every mutation would fail. CsrfCookieFilter below forces
                        // the token to materialise on ordinary responses.
                        //
                        // The plain handler (not the default XOR one) is required:
                        // it resolves to the same value the cookie carries, so the
                        // header the client echoes back actually matches.
                        .csrfTokenRequestHandler(csrfCookieFilter)
                        // The WebSocket handshake is not a credential-bearing
                        // browser request in the CSRF sense: the STOMP CONNECT
                        // frame is authenticated separately by
                        // JwtChannelInterceptor, and SockJS cannot attach the
                        // header itself.
                        .ignoringRequestMatchers("/ws-board/**")
                        // The auth endpoints are exempt because they are the ones
                        // a client must be able to call before it holds a token.
                        // Requiring a CSRF token on refresh/logout would mean the
                        // client's first move after an expired session is a 403
                        // it cannot recover from - measured in a real browser:
                        // /auth/refresh returned 403 and the app looped on it.
                        //
                        // This does not widen the attack surface in a way that
                        // matters. login and signup are unauthenticated, so
                        // forging them achieves only what the attacker could do
                        // by logging in as themselves. refresh and logout require
                        // the HttpOnly refresh cookie, which a cross-site caller
                        // cannot read, and the outcomes are respectively "renew my
                        // own session" and "end my own session" - neither acts on
                        // anyone else's behalf.
                        .ignoringRequestMatchers("/api/auth/login", "/api/auth/signup",
                                "/api/auth/refresh", "/api/auth/logout"))
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public: auth endpoints and the SockJS/STOMP handshake.
                        // STOMP CONNECT frames are authenticated by JwtChannelInterceptor.
                        .requestMatchers("/api/auth/login", "/api/auth/signup",
                                "/api/auth/refresh", "/api/auth/logout",
                                "/ws-board", "/ws-board/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        // Pure REST: missing/invalid token must be 401, never a redirect.
                        .authenticationEntryPoint((request, response, authException) ->
                                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized"))
                        // A rejected CSRF token is an authorization failure and must
                        // answer 403, not 401: the client's interceptor reads 401 as
                        // "access token expired" and would spend a single-use refresh
                        // token retrying a request that can never succeed.
                        //
                        // The status is written directly rather than via sendError,
                        // because sendError dispatches to /error, which re-enters this
                        // chain and answers 401 for the /error request. Measured with
                        // curl: a tokenless POST returned 401 while the log showed the
                        // 403 being sent.
                        .accessDeniedHandler((request, response, deniedException) -> {
                            log.debug("Access denied on {} {}: {}", request.getMethod(),
                                    request.getRequestURI(), deniedException.getClass().getSimpleName());
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/problem+json");
                            try {
                                response.getWriter().write(
                                        "{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403}");
                            } catch (IOException ignored) {
                                // Client hung up; nothing useful left to do.
                            }
                        }))
                .authenticationProvider(daoAuthenticationProvider())
                // Ahead of authentication so even a 401 carries the headers.
                .addFilterBefore(securityHeadersFilter, UsernamePasswordAuthenticationFilter.class)
                // Ahead of CSRF, deliberately. CsrfFilter runs before
                // UsernamePasswordAuthenticationFilter, so at the moment it
                // rejects a bad token the SecurityContext is still empty and
                // Spring treats the caller as anonymous - answering 401 instead
                // of 403. That is worse than untidy: the client's interceptor
                // reads 401 as "token expired" and spends a refresh token
                // retrying a request that can never succeed. Authenticating
                // first makes a CSRF failure the authorization error it is.
                // Safe because this filter only populates the SecurityContext
                // from a valid token; it grants no access on its own.
                .addFilterBefore(jwtAuthFilter, CsrfFilter.class);
        return http.build();
    }

    /**
     * Writes 403 for a rejected CSRF token.
     *
     * <p>{@code sendError} is deliberately not used. It triggers a container
     * dispatch to {@code /error}, which re-enters this filter chain; the second
     * pass finds no authentication and the {@code /error} dispatch answers 401,
     * so the client sees the wrong status. Verified with curl: a POST without a
     * CSRF token returned 401 while the log showed the 403 being sent.
     *
     * <p>The distinction is not cosmetic. The client's response interceptor reads
     * 401 as "access token expired" and spends a single-use refresh token
     * retrying a request that can never succeed, so a CSRF failure would
     * silently burn a refresh and log the user out.
     *
     * <p>The response is committed directly, so {@code /error} is never reached.
     * The body is left empty because this is a JSON API whose errors are
     * otherwise RFC 7807 problem documents produced by
     * {@code GlobalExceptionHandler}.
     */
    private void csrfFailure(HttpServletResponse response, AccessDeniedException exception) throws IOException {
        log.debug("Rejected CSRF token: {}", exception.getClass().getSimpleName());
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/problem+json");
        response.getWriter().write(
                "{\"type\":\"about:blank\",\"title\":\"Forbidden\",\"status\":403,"
                        + "\"detail\":\"Invalid or missing CSRF token\"}");
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .toList());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider daoAuthenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}
