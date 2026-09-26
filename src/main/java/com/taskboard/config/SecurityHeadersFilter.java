package com.taskboard.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Baseline security headers on every backend response.
 *
 * <p>Note on scope: this service is a pure JSON API and serves no HTML, so
 * there is no document here for a browser to frame or sniff. These headers
 * therefore harden the API surface (and any future HTML or error page the
 * backend might render) rather than providing the main XSS defence. The
 * Content-Security-Policy that actually protects the application is served
 * with the document by the frontend host - see frontend/vite.config.ts.
 *
 * <p>Every value is additive: none of them change how the SPA or the STOMP
 * client behave.
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // Stops a browser from re-interpreting a JSON body as HTML or script
        // if a response is ever reachable through a content-type confusion.
        response.setHeader("X-Content-Type-Options", "nosniff");

        // Clickjacking guard. Modern browsers prefer CSP frame-ancestors, which
        // is also sent by the frontend host; this is the defence for any page
        // the backend itself renders (e.g. a default error page).
        response.setHeader("X-Frame-Options", "DENY");

        // Do not leak full URLs (which can carry board and user ids) to
        // third-party origins on navigation.
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

        // Deny powerful browser features the app never uses. camera/mic/
        // geolocation are the ones worth naming in a review.
        response.setHeader("Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), interest-cohort=()");

        // HSTS is meaningless over plain HTTP (browsers ignore it) and would
        // break local development against http://localhost, so it is only sent
        // when the request actually arrived over TLS.
        if (request.isSecure()) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }

        // Auth errors are rendered by sendError() into the servlet container's
        // error page, which would otherwise echo the raw exception message.
        response.setHeader("X-Error-Page", "suppress");

        filterChain.doFilter(request, response);
    }
}