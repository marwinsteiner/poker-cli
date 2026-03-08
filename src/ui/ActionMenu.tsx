import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AvailableAction, PlayerAction } from '../engine/types.js';

interface ActionMenuProps {
  actions: AvailableAction[];
  isActive: boolean;
  onSelect: (action: PlayerAction) => void;
  onRaiseStart: (action: AvailableAction) => void;
}

export function ActionMenu({ actions, isActive, onSelect, onRaiseStart }: ActionMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [actions.length]);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.leftArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.rightArrow) {
      setSelectedIndex(prev => Math.min(actions.length - 1, prev + 1));
    } else if (key.return) {
      const action = actions[selectedIndex];
      if (!action) return;

      if (action.type === 'raise') {
        onRaiseStart(action);
      } else if (action.type === 'allin') {
        onSelect({ type: 'allin', amount: action.maxRaise });
      } else if (action.type === 'call') {
        onSelect({ type: 'call', amount: action.callAmount });
      } else {
        onSelect({ type: action.type });
      }
    }
  }, { isActive });

  if (actions.length === 0) return null;

  // Clamp selectedIndex
  const idx = Math.min(selectedIndex, actions.length - 1);

  return (
    <Box gap={2} justifyContent="center">
      {actions.map((action, i) => {
        const isSelected = i === idx && isActive;
        const label = action.label;
        if (isSelected) {
          return (
            <Text key={action.type + i} bold inverse color="green">
              {` ${label} `}
            </Text>
          );
        }
        return (
          <Text key={action.type + i} dimColor={!isActive}>
            {` ${label} `}
          </Text>
        );
      })}
    </Box>
  );
}
