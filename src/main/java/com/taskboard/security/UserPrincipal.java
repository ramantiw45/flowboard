package com.taskboard.security;

import com.taskboard.user.User;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Spring Security principal wrapping our {@link User} entity.
 * Injected into controllers via @AuthenticationPrincipal.
 */
@Getter
@RequiredArgsConstructor
public class UserPrincipal implements UserDetails {

    private final UUID id;
    private final String email;
    private final String displayName;
    private final String password;

    public static UserPrincipal from(User user) {
        return new UserPrincipal(user.getId(), user.getEmail(), user.getDisplayName(), user.getPasswordHash());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
