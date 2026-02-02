import { useState } from "react";
import { Box } from "ink";
import TextInput from "ink-text-input";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
}: ChatInputProps): React.ReactElement {
  const [value, setValue] = useState("");

  const handleSubmit = (submittedValue: string) => {
    if (submittedValue.trim()) {
      onSubmit(submittedValue.trim());
      setValue("");
    }
  };

  return (
    <Box borderStyle="single" borderColor={disabled ? "gray" : "cyan"} paddingX={1}>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        focus={!disabled}
      />
    </Box>
  );
}
