package com.taskboard.dto.list;

import com.taskboard.card.Card;
import com.taskboard.list.BoardList;
import com.taskboard.dto.card.CardResponse;

import java.util.List;
import java.util.UUID;

public record ListResponse(
        UUID id,
        String name,
        double position,
        long version,
        List<CardResponse> cards) {

    public static ListResponse from(BoardList list, List<Card> cards) {
        return new ListResponse(
                list.getId(),
                list.getName(),
                list.getPosition(),
                list.getVersion(),
                cards.stream().map(CardResponse::from).toList());
    }
}
