import { PresenceTracker, parseListOutput } from '../src/mc/presence';

describe('PresenceTracker', () => {
  test('handles add/remove', () => {
    const presence = new PresenceTracker(1);
    presence.handlePlayerAdded(['Alice'], 0);
    expect(presence.getRoster()).toEqual(['Alice']);
    presence.handlePlayerRemoved(['Alice'], 10);
    expect(presence.getRoster()).toEqual([]);
  });

  test('handles chat join/leave', () => {
    const presence = new PresenceTracker(1);
    presence.handleChatSystem('Bob joined the game', 0);
    expect(presence.getRoster()).toEqual(['Bob']);
    presence.handleChatSystem('Bob left the game', 1);
    expect(presence.getRoster()).toEqual([]);
  });

  test('reconciles list output', () => {
    const presence = new PresenceTracker(1);
    presence.handlePlayerAdded(['Alice', 'Bob'], 0);
    presence.reconcileFromList(['Bob'], 2);
    expect(presence.getRoster()).toEqual(['Bob']);
  });
});

describe('parseListOutput', () => {
  test('parses list output', () => {
    expect(parseListOutput('There are 2/20 players online: Alice, Bob')).toEqual(['Alice', 'Bob']);
  });
});
