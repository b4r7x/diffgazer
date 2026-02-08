export const isValidProjectPath = (value: string): boolean => {
  if (value.includes("..") || value.includes("\0")) {
    return false;
  }
  return true;
};
