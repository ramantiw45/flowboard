package com.taskboard.board;

/**
 * Role of a user within a single board. Ownership transfers with the
 * OWNER flag; ADMIN can manage lists/members, MEMBER can only move/edit cards.
 */
public enum MemberRole {
    OWNER,
    ADMIN,
    MEMBER
}
