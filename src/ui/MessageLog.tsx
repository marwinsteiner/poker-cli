import React from 'react';
import { Box, Text } from 'ink';

interface MessageLogProps {
  messages: string[];
}

export function MessageLog({ messages }: MessageLogProps) {
  const display = messages.slice(-5);

  return (
    <Box flexDirection="column" paddingX={1}>
      {display.map((msg, i) => {
        const isNewest = i === display.length - 1;
        return (
          <Text key={`${i}-${msg}`} bold={isNewest} dimColor={!isNewest}>
            {'> '}{msg}
          </Text>
        );
      })}
    </Box>
  );
}
