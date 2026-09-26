package com.taskboard.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * Ensures the SPA actually receives a CSRF cookie, on ordinary responses.
 *
 * <p>Spring's default handler does not manage to, for an API that never renders
 * a form. Two measured failures, both found by driving the running app with curl
 * rather than by reading the configuration:
 *
 * <ol>
 *   <li><b>No cookie on normal responses.</b> The token is resolved lazily and
 *       nothing in a JSON API dereferences it, so {@code GET /api/auth/me}
 *       returned no {@code Set-Cookie} at all.</li>
 *   <li><b>The cookie was deleted, not set.</b> The default handler passes
 *       {@code null} to the repository on paths where no token is needed, which
 *       the repository renders as {@code Set-Cookie: XSRF-TOKEN=; Max-Age=0} -
 *       a deletion. The raw response showed a new cookie immediately followed by
 *       a delete for it, so the browser kept no token and <em>every write would
 *       fail</em> with 403.</li>
 * </ol>
 *
 * <p>Resolving the token on every request fixes both: the response always
 * carries the token the client is expected to echo back, and because the value
 * is never null, the repository never emits the deletion.
 *
 * <p>This is the double-submit pattern. The cookie is deliberately readable by
 * script (that is the point of the pattern); the session cookie is not - it is
 * {@code HttpOnly}, so nothing here weakens it.
 */
@Component
public class CsrfCookieFilter implements CsrfTokenRequestHandler {

    private final CsrfTokenRepository tokenRepository;

    public CsrfCookieFilter(CookieCsrfTokenRepository repository) {
        this.tokenRepository = repository;
    }

    @Override
    public void handle(@NonNull HttpServletRequest request,
                       @NonNull HttpServletResponse response,
                       @NonNull Supplier<CsrfToken> deferredCsrfToken) {
        // Reuse the token the client already has, if any. Issuing a fresh one on
        // every response breaks clients that cache it: the token rotates between
        // two consecutive writes, so the second is rejected. Measured with
        // PowerShell: the jar held 6ff92df1... before a write and a0200298...
        // after it, and the next write 403'd.
        //
        // loadToken() returns the cookie's token without minting a new one, so
        // this only pays the cost when the client genuinely has none.
        CsrfToken token = tokenRepository.loadToken(request);
        if (token == null) {
            // No token yet: resolve the deferred one so the cookie is issued.
            // This is the case that previously produced no cookie at all.
            token = deferredCsrfToken.get();
        }
        // Publish it for anything downstream that wants to read it.
        request.setAttribute(CsrfToken.class.getName(), token);
        // Never null, so this writes the cookie and never deletes it.
        tokenRepository.saveToken(token, request, response);
    }
}